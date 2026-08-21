# Vini POS — Two Restaurants, One Codebase

Two deliberately opposite tenants. If both work without a line of
per-customer code, the config-over-code thesis holds. If either needs a
special case, the architecture is wrong and we want to know now.

Seeded by `apps/web/scripts/seed-demo-orgs.mjs` — these are real rows you can
sign into, not hypotheticals.

---

## Restaurant A — Saffron House (the long flow)

**Who:** 40-cover full-service North Indian restaurant, part of a 6-outlet
franchise group. Owner has a manager, 4 captains, 3 kitchen staff, 2 billers.

**Org type:** `franchise` · **Modules:** all on · **Slug:** `saffron-house`

### The full order journey

```
Captain takes order at Table 12 (mobile)
   ↓ order created, source = captain
Kitchen (KOT) receives ticket, starts prep
   ↓ marks items ready as they come off the pass
Captain serves, guest asks for the bill
   ↓
Biller pulls up Table 12 at POS, applies a 10% regular-guest discount
   ↓ discount > threshold → workflow: manager approval
Manager approves on their phone
   ↓
Payment split across UPI + cash
   ↓
Order closed. Inventory deducts recipe ingredients.
   Finance records the covers. CRM logs the guest's third visit this month.
```

### Stories

| # | As a… | I want to… | So that… | Status |
|---|---|---|---|---|
| A1 | Vini super admin | create Saffron House as a franchise org with an admin login | the owner can get in without me provisioning every user | ✅ built |
| A2 | Org admin | invite a captain, a biller and kitchen staff by role | my team signs in themselves, I don't call Vini | ✅ built |
| A3 | Captain | take a table order on my phone | I don't walk to a terminal between courses | ⬜ Phase 3 |
| A4 | Kitchen | see tickets appear live and bump them when ready | the pass knows what's actually done | ✅ built (KOT board) |
| A5 | Biller | pull up an open table and settle it | the guest isn't waiting | ✅ built (POS billing) |
| A6 | Manager | approve a discount above ₹500 from my phone | billers can't quietly discount away margin | ⬜ workflow engine |
| A7 | Owner | see stock deduct automatically per recipe | I know my food cost without counting | ⬜ inventory module |
| A8 | Owner | see covers, revenue and repeat guests | I can act on a slow Tuesday | ⬜ finance + CRM |

**Why this one matters:** it exercises every module. If Saffron House can be
configured rather than coded, the platform works for the hardest case.

---

## Restaurant B — Chai Point Express (the short flow)

**Who:** single-counter chai and snacks kiosk in an office park. Two staff,
no table service, no kitchen ticket rail — the person taking money makes the
chai. Owner is an investor who also runs three other kiosks.

**Org type:** `investor` · **Modules:** inventory, finance, marketing_crm
**off** · **Slug:** `chai-point-express`

### The whole journey

```
Guest scans QR at the counter (or the operator takes it at POS)
   ↓ order created, source = qr | pos
Payment taken immediately
   ↓
Ticket appears on the counter screen
   ↓
"Chai ready" — guest collects
   ↓
Done.
```

No captain. No table. No approval step. No stock deduction. Four states, not
nine.

### Stories

| # | As a… | I want to… | So that… | Status |
|---|---|---|---|---|
| B1 | Vini super admin | create the org with inventory/finance/CRM switched off | the operator isn't shown Purchase Orders on a chai counter | ✅ built |
| B2 | Operator | see only POS, KOT and Menu in my sidebar | I can train someone in ten minutes | ✅ **built — this is the test below** |
| B3 | Guest | scan, order, pay, collect | no queue at the counter | ⬜ QR module |
| B4 | Owner | switch Inventory on later when I start tracking milk | I'm not locked out of growth by my day-one choice | ✅ built (toggle) |

**Why this one matters:** it proves modules can be *absent*, not just unbuilt.
The same deploy serves both restaurants — Saffron sees 17 nav entries,
Chai Point sees 11, and no branch in the code knows either restaurant's name.

---

## The contrast, concretely

| | Saffron House | Chai Point Express |
|---|---|---|
| Order sources | captain, POS, QR, delivery | QR, POS |
| Approval steps | 1 (manager on discount) | 0 |
| Sidebar entries | all | Inventory, Customers, Payments, Reports hidden |
| Staff roles in use | 5 | 2 |
| Same codebase | ✅ | ✅ |
| Same deploy | ✅ | ✅ |
| Lines of per-tenant code | **0** | **0** |

---

## How to test module configuration end to end

The point of this exercise: change a toggle in the admin UI, watch a real
org's navigation change. Nothing here is mocked.

### 0. Apply the control plane migration (once)

Nothing below works until migration 0007 exists in the database. It is
additive — five new tables, no changes to existing ones.

```bash
cd "/Users/lohit/Downloads/Vinni Pos" && docker run --rm -i postgres:17-alpine psql "$(grep -E '^SUPABASE_DB_URL=' .env.local | cut -d= -f2-)" -v ON_ERROR_STOP=1 < supabase/migrations/0007_control_plane.sql
```

### 1. Seed the two restaurants

```bash
cd "/Users/lohit/Downloads/Vinni Pos/apps/web" && node --env-file=../.env.local scripts/seed-demo-orgs.mjs
```

### 2. See the difference

Sign in at `/login` as each admin and compare the left sidebar:

| Sign in as | Password | Expect |
|---|---|---|
| `admin@saffronhouse.example` | `SaffronDemo2026!a` | full sidebar — Inventory, Customers & CRM, Payments, Reports all present |
| `admin@chaipoint.example` | `ChaiDemo2026!b` | **no** Inventory, **no** Customers & CRM, **no** Payments, **no** Reports |

### 3. Flip a toggle and watch it land

1. Sign in as the Vini super admin (`vinipos.mas-admin@vinipos.com`)
2. Go to **Organizations → Chai Point Express**
3. In the **Modules** card, switch **Inventory** on
4. Sign in as `admin@chaipoint.example` (or reload if already in)
5. **Inventory now appears in their sidebar.** No deploy, no code change.

Switch it back off and it disappears again. That round trip is the whole
config-over-code claim, demonstrable in about 90 seconds.

### 4. Confirm core modules can't be broken

In the same Modules card, try to disable **POS** or **Orders**. The action is
rejected — `setOrgModuleEnabled()` refuses core modules server-side, not just
in the UI, so an API call can't do it either.

### 5. Clean up when you're done

```bash
cd "/Users/lohit/Downloads/Vinni Pos/apps/web" && node --env-file=../.env.local scripts/seed-demo-orgs.mjs --remove
```

Deletes both orgs, their admin auth users, module rows and domains. It only
touches orgs carrying `settings.demo_seed = true`, so a real organization
that happens to share a slug is skipped rather than deleted.
