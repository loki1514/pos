# Vini POS — Platform Architecture v1

Consolidates three things asked for in one sitting: custom-domain multi-tenancy
on our actual stack (Vercel + Supabase + Hostinger — not Ceryx/Traefik/Nginx),
the workflow builder pattern used by Qandle/Keka/Darwinbox adapted to
restaurant approval chains, and a module registry so the full restaurant nav
tree exists today as togglable placeholders instead of being built blind.

None of this is built yet. This is the plan; each section says what ships it.

---

## 1. Multi-tenant domains — Vercel + Supabase, no reverse proxy needed

The video's architecture (Cloudflare/Nginx → Ceryx → tenant router) solves a
problem we don't have, because Vercel's edge network already **is** the
wildcard router and SSL terminator. Standing up Traefik/Caddy on Hostinger
would be re-building infrastructure Vercel gives us for free.

### What each piece is actually for

| Piece | Video's version | Ours | Why |
|---|---|---|---|
| Wildcard SSL + routing | Ceryx / Traefik / Nginx | **Vercel Domains API** | Vercel auto-provisions SSL per domain and routes at the edge — this is the whole first half of the video, solved |
| DNS | manual/Cloudflare | **Hostinger DNS** (or Cloudflare if we move off Hostinger's nameservers later) | Wherever `vinipos.com`'s nameservers already live |
| Tenant resolution | custom Nginx middleware reading `Host` | **Next.js `proxy.ts`**, already reading cookies per-request | We already have the exact hook point |
| Config/theme per tenant | Config Service + Redis | **`organizations` table** (`slug`, `settings` jsonb) | Already exists (migration 0001) |

### The two domain shapes we need

**A. Platform subdomains — `<org-slug>.vinipos.com`** (default, every org gets this free)

> **Corrected 2026-08-19 after checking the live Vercel account.** An earlier
> draft of this section said Hostinger keeps DNS and we just add one wildcard
> record. That is wrong. Vercel's docs are explicit: *"If using your custom
> domain as a wildcard domain, you **must use the nameservers method for
> verification**."* A CNAME or A record will not work for `*.vinipos.com`.

- **`vinipos.com` nameservers must move to Vercel.** Hostinger stays the *registrar*, but stops being the DNS provider — you change the nameservers at Hostinger to the ones Vercel issues, and from then on every DNS record for the domain (including any unrelated mail or marketing records) has to live in Vercel's DNS panel. Vercel's own warning: *"you will need to add any DNS records to Vercel that you wish to keep from your previous DNS provider."*
- Then add `*.vinipos.com` in Vercel project settings. Vercel enables its nameservers automatically on save and issues one wildcard certificate covering every subdomain — no per-tenant provisioning call at all.
- Tenant resolution: `proxy.ts` reads `request.headers.get('host')`, strips `.vinipos.com`, looks up the `slug` against `organizations`. Already implemented (migration 0007 branch).

**Plan constraints, checked rather than assumed:**

| Claim | Verdict |
|---|---|
| Wildcards require a Pro plan | **False.** All plans support wildcard domains. |
| Wildcards require Vercel nameservers | **True.** Confirmed in Vercel's docs. |
| Hobby caps custom domains | **True — 50 per project** (Pro is ~100,000). |

The 50-domain cap matters less than it first appears: the **wildcard is a single
domain entry** covering unlimited `*.vinipos.com` subdomains. The cap only binds
on **tenants who bring their own domain** (option B). So on Hobby: unlimited
platform subdomains, ~49 bring-your-own-domain tenants. Pro is a scaling
decision for later, not a blocker now.

**B. Bring-your-own domain — `pos.krave.com`** (opt-in, for a client like Krave who wants their own domain)

- Client points a CNAME (`pos.krave.com → cname.vercel-dns.com`) at their own DNS provider — we never touch their DNS.
- We call **Vercel's Domains API** (`POST /v10/projects/{id}/domains`) server-side when the org admin adds the domain from `/org/settings`. Vercel verifies the CNAME and auto-issues SSL. No manual dashboard clicking per client, no downtime, no reverse-proxy migration risk — this is precisely the failure mode the video is warning about, and Vercel's API removes it entirely.
- We store the mapping in a new `org_domains` table (`domain`, `organization_id`, `verified_at`) so `proxy.ts` can resolve custom domains the same way it resolves `*.vinipos.com` slugs.

### Data model addition (not yet written)

```sql
create table public.org_domains (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain          text not null unique,
  is_primary      boolean not null default false,
  verified_at     timestamptz,
  created_at      timestamptz not null default now()
);
```

`proxy.ts` gains one lookup at the top: custom domain → `org_domains` →
`organization_id`; subdomain → `organizations.slug` → `organization_id`.
Everything downstream (RLS, `getMyOrg()`) is already tenant-scoped by
`organization_id`, so nothing else changes.

### What this buys us vs. the video's approach

- **Onboarding a new org's domain = one API call**, not a server config edit — matches the video's own stated goal ("no manual server configs").
- **Zero downtime risk on infra changes** — there's no reverse proxy to migrate off later, because Vercel's edge network *is* the reverse proxy, and we're not operating it ourselves.
- **Hostinger becomes registrar-only.** After the nameserver switch it holds the registration and nothing else; DNS lives in Vercel. That's a one-time migration with a real gotcha — any existing records on `vinipos.com` (email MX especially) must be recreated in Vercel first, or they break the moment nameservers cut over.

### Current state of the Vercel project (checked 2026-08-19)

| | |
|---|---|
| Project | `pos` · `prj_iEDTSf7q9pmRIbkTYVR3ww4YzxGF` |
| Team scope | `team_nctzr7edH7wGSIm9Xw59GoIt` (Hobby — personal account) |
| Domains attached | `pos-ten-rosy.vercel.app` only |
| `vinipos.com` | **not added** |
| `*.vinipos.com` | **not added** |

So nothing routes by tenant yet in production. The prerequisite chain, in
order — none of it automatable, all of it one-time:

1. Own `vinipos.com` (registrar: Hostinger).
2. Recreate any existing `vinipos.com` DNS records in Vercel's DNS panel.
3. Add `vinipos.com` to the `pos` project.
4. Add `*.vinipos.com` → Vercel auto-enables its nameservers and shows them.
5. Change nameservers at Hostinger to Vercel's.
6. Wait for propagation, confirm "Valid Configuration".

**Only after step 6 does the Domains-card automation have anything to do.**
Until then the API integration would attach domains to a project whose apex
isn't verified, and nothing would resolve.

### Not building

Ceryx, Traefik, Caddy, or any self-hosted proxy. The video correctly says
these are the modern alternative *to Ceryx* — but the reason to reach for any
of them is "I'm not on a platform that already does this." We are.

---

## 2. Workflow builder — restaurant approval chains, not HR chains

Same pattern as the Qandle example (drag-drop canvas → JSON → engine reads
JSON), retargeted at what Vini POS actually needs approval chains for:
**low-stock alerts, discount approval, refund approval, shift swap approval**
— not leave requests. The mechanism is identical; only the node types differ.

### Data model (extends what's already there)

```sql
create table public.org_workflows (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  key              text not null,              -- e.g. 'discount_approval'
  name             text not null,
  version          int not null default 1,
  definition       jsonb not null,              -- {nodes:[], edges:[]}
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),

  unique (organization_id, key, version)
);

create table public.workflow_runs (
  id               uuid primary key default gen_random_uuid(),
  workflow_id      uuid not null references public.org_workflows(id),
  workflow_version int not null,               -- frozen at creation — the video's "biggest gotcha", already designed for
  subject_type     text not null,                -- 'discount', 'refund', 'stock_alert'
  subject_id       uuid not null,
  current_node     text not null,
  status           text not null default 'running',  -- running | approved | rejected
  created_at       timestamptz not null default now()
);
```

`workflow_version` is frozen on the run row at creation time, exactly per the
video's versioning warning — an in-flight refund approval keeps running under
the rules it started with even if the org admin edits the workflow tomorrow.

### Node types for v1 (restaurant-scoped, not the HR set)

| Node | Meaning |
|---|---|
| `start` / `end` | fixed endpoints |
| `approval` | role-gated approval step (`role: 'manager'`, `sla_minutes: 30`) |
| `condition` | branch on a field (`amount > 500`, `item_category == 'liquor'`) |
| `notify` | fire an alert to a role/location, no approval required |
| `auto` | terminal auto-action (`auto_approve`, `auto_escalate`) |

### Engine

A plain state-machine function, not Temporal/n8n — our approval chains are
shallow (2–4 steps) and don't need durable-execution infrastructure. One
Postgres function or one server action that:

1. reads `org_workflows.definition` for the active version
2. reads `workflow_runs.current_node`
3. on an approval/rejection event, evaluates the next edge (following a
   `condition` node's rule via simple JS, not a rules library — the
   conditions here are single comparisons, not the branching logic a HR
   engine needs)
4. writes the new `current_node`, or closes the run

### Builder UI

**React Flow** (`@xyflow/react`) for the canvas — this is the standard choice
cited in the source material and is MIT-licensed, actively maintained. Lives
at `/admin/workflows` (super admin builds/edits templates) with an org-scoped
read-only view at `/org/settings/workflows` showing what's active for that
tenant. Org admins choose which template applies to their org and set
role/SLA values; they don't build workflows from scratch in v1 — that stays a
Vini-configured thing until there's demand for full self-service.

### Explicitly not built in the UI

Payroll math, tax calculation, GST logic, inventory deduction math — anything
that's "hard logic" per the source material stays in code, same principle
they state. The builder only ever answers "who approves what, in what order."

### Build order

Not started. This is Phase 4/5 territory — it depends on Roles (done),
Locations (not done), and at least one real approval need existing in the
product (discounts, refunds) to design node types against real behavior
rather than guesses.

---

## 3. Module registry — the full nav tree, as togglable placeholders, today

This is the part that ships first, because it's cheap and everything else
depends on the pattern existing.

### The principle

Every module in the nav tree below gets a route and a sidebar entry **today**.
Modules not yet built render the existing `Planned` component
([components/admin/Planned.tsx](../apps/web/src/components/admin/Planned.tsx))
— already built, already used on 6 of the current `/admin/*` routes. Modules
get a `"Coming soon"` badge until their build order slot arrives (same pattern
`OrgSidebar.tsx` already uses for `ready?: boolean`).

Whether a module is **visible at all** for a given org is a per-tenant switch,
not a build-time decision — this is the actual ask ("each module node can be
turned on or off based on tenant need").

### Data model addition

```sql
create table public.modules (
  key          text primary key,        -- 'inventory', 'finance', 'crm', ...
  name         text not null,
  "group"      text not null,           -- 'Orders', 'POS', 'KDS', ...
  is_core      boolean not null default false,  -- core modules can't be turned off
  sort_order   int not null default 0
);

create table public.org_modules (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key      text not null references public.modules(key),
  enabled         boolean not null default true,
  primary key (organization_id, module_key)
);
```

Core modules (Orders, POS, KOT, Users & Roles) ship pre-enabled for every org
and aren't shown as toggleable — matches the vision doc's own distinction
between what every org needs and what's optional per §3 (organization
configuration).

### Full module tree (from the nav map supplied), mapped to groups

```
Dashboard        Command Centre · Sales Insights · Action Centre
Orders  (core)   Live Orders · Dine-In · Captain Order Taking · Dining Areas
                 Reservations · QR Ordering · Delivery
POS     (core)   Billing · Held Bills · Bill Settings · Printers · Devices
KDS/KOT (core)   Kitchen Screen · Station Tickets · Item States · Bump
Menu    (core)   Categories · Items · Variants · Modifiers · Media · Channel Pricing
Inventory        Items · Units · Opening Stock · Adjustments · Wastage
                 Recipes · Suppliers · Purchase Orders · GRN · Reports
Finance          Dashboard · Cashflow · Expenses · Top-Ups · Withdrawals
                 Owner Capital · Accounts · Revenue Share · Reports
Marketing/CRM    Customers · Campaigns · Offers · Loyalty
Staff   (core)   Directory · Attendance · Shifts · Salary/Advances
                 Staff Users · Access Control
Settings (core)  Restaurant Profile · Order Settings · Devices · Printing
                 Integrations · Subscription · Data Readiness
```

`(core)` groups are always on. Inventory, Finance, Marketing/CRM are the
first candidates for per-tenant toggle — an investor-type org running a
single QR-ordering kiosk has no use for Purchase Orders or Loyalty campaigns.

### Where this surfaces

- **`/org/*` sidebar** — reads `org_modules` for the signed-in org, renders
  every module in the tree, `Planned` placeholder for unbuilt ones, hidden
  entirely for disabled ones (not just badged — genuinely absent from nav).
- **`/admin/organizations/[id]`** — a new "Modules" card, checkboxes per
  group, super admin toggles what a given org can see. This is the control
  surface for "turned on or off based on tenant need."
- **Org Configuration** (build order Phase 1 #7, not started) is where an org
  admin will eventually request module changes themselves; until then, Vini
  toggles it from the org detail page.

### Build order

1. `modules` + `org_modules` migration, seeded with the tree above
2. Sidebar reads real module list instead of the hardcoded `SECTIONS` array
   currently in `OrgSidebar.tsx`
3. Toggle UI on `/admin/organizations/[id]`
4. Each module's actual screen gets built per the existing Phase 3/4 build
   order — the registry doesn't change *what* gets built next, only makes
   the full map visible and switchable from day one.

---

## What ships next, concretely

Section 3 (module registry) is the only piece with no unresolved design
questions and no dependency on product decisions that don't exist yet — it's
the next buildable thing. Sections 1 and 2 are architecture, not yet code;
1 needs a decision on whether Hostinger stays as DNS-only or the domain
moves to Vercel-managed DNS, and 2 needs at least one real approval workflow
(discounts or refunds) to design against.
