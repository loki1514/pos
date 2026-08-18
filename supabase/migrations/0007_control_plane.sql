-- ============================================================================
-- 0007 — Control plane (multi-tenant platform layer)
--
-- One codebase, many organizations. This migration builds the control plane
-- the platform admin operates:
--
--   org_domains    — hostnames that resolve to an organization (subdomain of
--                    the platform base domain, or a custom domain).
--   modules        — the platform's module registry (config-over-code: a
--                    feature exists once, organizations toggle it).
--   org_modules    — per-organization module enablement + config.
--   org_workflows  — versioned workflow templates. organization_id NULL marks
--                    a platform template available to every org; orgs copy or
--                    define their own versions.
--   workflow_runs  — a workflow instance pinned to the version it started on,
--                    so editing a template never rewrites in-flight runs.
--
-- organizations already has `slug` and `settings` (0001), so the host → org
-- resolution path is: subdomain label → organizations.slug, anything else →
-- org_domains.domain.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Organization domains
-- ----------------------------------------------------------------------------

create table public.org_domains (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  domain          text not null,
  kind            text not null default 'subdomain'
    check (kind in ('subdomain', 'custom')),
  is_primary      boolean not null default false,
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),

  constraint org_domains_domain_lowercase check (domain = lower(domain)),
  constraint org_domains_domain_format
    check (domain ~ '^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$')
);

comment on table public.org_domains is
  'Hostnames that resolve to an organization. Subdomain rows mirror <slug>.<base>; custom rows need verified_at before traffic is routed.';

create unique index org_domains_domain_key on public.org_domains (domain);
create index org_domains_organization_id_idx on public.org_domains (organization_id);

alter table public.org_domains enable row level security;

create policy org_domains_platform_admin_all
  on public.org_domains for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Members may read their own organization's domains (e.g. to show "your site
-- is at ..." in settings). Writes stay with the platform admin.
create policy org_domains_member_select
  on public.org_domains for select
  using (organization_id = public.current_org_id());

grant select on public.org_domains to authenticated;
grant all privileges on public.org_domains to service_role;

-- ----------------------------------------------------------------------------
-- Module registry
--
-- Reference data, like roles (0004): readable by any signed-in user, written
-- only by the platform admin. submodules is a jsonb list of {key, name} — a
-- separate table would only add joins for data that is edited once a quarter.
-- ----------------------------------------------------------------------------

create table public.modules (
  key         text primary key,
  name        text not null,
  "group"     text,
  description text,
  submodules  jsonb not null default '[]'::jsonb,
  is_core     boolean not null default false,
  sort_order  int not null default 0,

  constraint modules_key_format check (key ~ '^[a-z0-9]+(_[a-z0-9]+)*$')
);

comment on table public.modules is
  'Platform module registry. is_core modules cannot be disabled per-org; the rest are config-over-code toggles.';

alter table public.modules enable row level security;

create policy modules_read on public.modules for select to authenticated using (true);

create policy modules_platform_admin_all
  on public.modules for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select on public.modules to authenticated;
grant all privileges on public.modules to service_role;

-- ----------------------------------------------------------------------------
-- Per-organization module toggles
--
-- Same pattern as 0006: members read their own org's rows; all writes go
-- through service_role (the app layer decides who may flip `enabled` vs only
-- `config` — org admins may tune config, only the platform admin enables or
-- disables a module).
-- ----------------------------------------------------------------------------

create table public.org_modules (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  module_key      text not null references public.modules (key) on delete cascade,
  enabled         boolean not null default true,
  config          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  primary key (organization_id, module_key)
);

comment on table public.org_modules is
  'Per-organization module state. Absence of a row means the module is not available to the org at all; enabled=false means available but switched off.';

create trigger org_modules_set_updated_at
  before update on public.org_modules
  for each row execute function public.set_updated_at();

alter table public.org_modules enable row level security;

create policy org_modules_platform_admin_all
  on public.org_modules for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy org_modules_member_select
  on public.org_modules for select
  using (organization_id = public.current_org_id());

grant select on public.org_modules to authenticated;
grant all privileges on public.org_modules to service_role;

-- ----------------------------------------------------------------------------
-- Workflow templates
--
-- definition is a directed graph: {nodes: [{id, type, data}], edges: [{from,
-- to, label?}]}. Shape is validated in the app layer (lib/tenant.ts); the
-- database only requires it to be an object with nodes/edges arrays.
-- ----------------------------------------------------------------------------

create table public.org_workflows (
  id              uuid primary key default gen_random_uuid(),
  -- NULL = platform template, available to every organization.
  organization_id uuid references public.organizations (id) on delete cascade,
  key             text not null,
  name            text not null,
  module          text not null default 'orders',
  version         int not null default 1,
  definition      jsonb not null default '{"nodes": [], "edges": []}'::jsonb,
  is_active       boolean not null default true,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint org_workflows_org_key_version_unique unique (organization_id, key, version),
  constraint org_workflows_version_positive check (version > 0),
  constraint org_workflows_definition_shape
    check (jsonb_typeof(definition) = 'object'
       and jsonb_typeof(definition -> 'nodes') = 'array'
       and jsonb_typeof(definition -> 'edges') = 'array')
);

comment on table public.org_workflows is
  'Versioned workflow definitions. organization_id NULL = platform template; orgs get their own rows (copied or custom) with monotonically increasing versions.';

create index org_workflows_organization_id_idx on public.org_workflows (organization_id);

create trigger org_workflows_set_updated_at
  before update on public.org_workflows
  for each row execute function public.set_updated_at();

alter table public.org_workflows enable row level security;

create policy org_workflows_platform_admin_all
  on public.org_workflows for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Members read platform templates (NULL org) and their own org's workflows.
create policy org_workflows_member_select
  on public.org_workflows for select
  using (organization_id is null or organization_id = public.current_org_id());

grant select on public.org_workflows to authenticated;
grant all privileges on public.org_workflows to service_role;

-- ----------------------------------------------------------------------------
-- Workflow runs
--
-- workflow_version is frozen at run creation: the template may move on, the
-- run finishes on the graph it started with.
-- ----------------------------------------------------------------------------

create table public.workflow_runs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  workflow_id      uuid not null references public.org_workflows (id) on delete restrict,
  workflow_version int not null,
  subject_type     text,
  subject_id       uuid,
  current_node     text not null default 'start',
  status           text not null default 'running'
    check (status in ('running', 'approved', 'rejected', 'completed')),
  state            jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.workflow_runs is
  'Workflow instances. workflow_version pins the template version at start; state carries node outputs/approvals.';

create index workflow_runs_organization_id_idx on public.workflow_runs (organization_id);
create index workflow_runs_workflow_id_idx on public.workflow_runs (workflow_id);
create index workflow_runs_subject_idx on public.workflow_runs (subject_type, subject_id);

create trigger workflow_runs_set_updated_at
  before update on public.workflow_runs
  for each row execute function public.set_updated_at();

alter table public.workflow_runs enable row level security;

create policy workflow_runs_platform_admin_all
  on public.workflow_runs for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy workflow_runs_member_select
  on public.workflow_runs for select
  using (organization_id = public.current_org_id());

create policy workflow_runs_member_insert
  on public.workflow_runs for insert
  with check (organization_id = public.current_org_id());

create policy workflow_runs_member_update
  on public.workflow_runs for update
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

grant select, insert, update on public.workflow_runs to authenticated;
grant all privileges on public.workflow_runs to service_role;

-- ----------------------------------------------------------------------------
-- Seed: module registry
-- ----------------------------------------------------------------------------

insert into public.modules (key, name, "group", description, submodules, is_core, sort_order) values
  ('dashboard', 'Dashboard', 'Overview', 'Org snapshot: command centre, sales insights and the action centre.',
   '[{"key":"command_centre","name":"Command Centre"},{"key":"sales_insights","name":"Sales Insights"},{"key":"action_centre","name":"Action Centre"}]'::jsonb,
   true, 10),
  ('orders', 'Orders', 'Operations', 'Live orders across every channel: dine-in, captain ordering, reservations, QR and delivery.',
   '[{"key":"live_orders","name":"Live Orders"},{"key":"dine_in","name":"Dine-In"},{"key":"captain_ordering","name":"Captain Order Taking"},{"key":"tables","name":"Dining Areas / Tables"},{"key":"reservations","name":"Reservations"},{"key":"qr_ordering","name":"QR Ordering"},{"key":"delivery","name":"Delivery"}]'::jsonb,
   true, 20),
  ('pos', 'POS / Billing', 'Operations', 'Point-of-sale billing, held bills and hardware configuration.',
   '[{"key":"billing","name":"Billing"},{"key":"held_bills","name":"Held Bills"},{"key":"bill_settings","name":"Bill Settings"},{"key":"printers","name":"Printers"},{"key":"devices","name":"Devices"}]'::jsonb,
   true, 30),
  ('kds_kot', 'Kitchen Display (KDS/KOT)', 'Operations', 'Kitchen screen with station tickets, item states and bump flow.',
   '[{"key":"kitchen_screen","name":"Kitchen Screen"},{"key":"station_tickets","name":"Station Tickets"},{"key":"item_states","name":"Item States"},{"key":"bump","name":"Bump"}]'::jsonb,
   true, 40),
  ('menu', 'Menu', 'Catalog', 'Menu structure and publishing: categories, items, variants, modifiers, media and channel pricing.',
   '[{"key":"categories","name":"Categories"},{"key":"items","name":"Items"},{"key":"variants","name":"Variants"},{"key":"modifiers","name":"Modifiers"},{"key":"media","name":"Media"},{"key":"channel_pricing","name":"Channel Pricing"},{"key":"publishing","name":"Publishing"}]'::jsonb,
   true, 50),
  ('inventory', 'Inventory', 'Back Office', 'Stock items, units, opening stock, adjustments, wastage, recipes, suppliers, purchasing and reports.',
   '[{"key":"items","name":"Items"},{"key":"units","name":"Units"},{"key":"opening_stock","name":"Opening Stock"},{"key":"adjustments","name":"Adjustments"},{"key":"wastage","name":"Wastage"},{"key":"recipes","name":"Recipes"},{"key":"suppliers","name":"Suppliers"},{"key":"purchase_orders","name":"Purchase Orders"},{"key":"grn","name":"GRN"},{"key":"stock_consumption","name":"Stock Consumption"},{"key":"reports","name":"Reports"}]'::jsonb,
   false, 60),
  ('finance', 'Finance', 'Back Office', 'Cashflow, expenses, top-ups, withdrawals, owner capital, accounts, revenue share and reports.',
   '[{"key":"dashboard","name":"Dashboard"},{"key":"cashflow","name":"Cashflow"},{"key":"expenses","name":"Expenses"},{"key":"top_ups","name":"Top-Ups"},{"key":"withdrawals","name":"Withdrawals"},{"key":"owner_capital","name":"Owner Capital"},{"key":"accounts","name":"Accounts"},{"key":"revenue_share","name":"Revenue Share"},{"key":"reports","name":"Reports"}]'::jsonb,
   false, 70),
  ('marketing_crm', 'Marketing & CRM', 'Growth', 'Customers, campaigns, offers and loyalty.',
   '[{"key":"customers","name":"Customers"},{"key":"campaigns","name":"Campaigns"},{"key":"offers","name":"Offers"},{"key":"loyalty","name":"Loyalty"}]'::jsonb,
   false, 80),
  ('staff', 'Staff', 'Back Office', 'Directory, attendance, shifts, salary/advances, staff users and access control.',
   '[{"key":"directory","name":"Directory"},{"key":"attendance","name":"Attendance"},{"key":"shifts","name":"Shifts"},{"key":"salary_advances","name":"Salary / Advances"},{"key":"staff_users","name":"Staff Users"},{"key":"access_control","name":"Access Control"}]'::jsonb,
   true, 90),
  ('settings', 'Settings', 'Configuration', 'Restaurant profile, order settings, devices, printing, integrations, subscription and data readiness.',
   '[{"key":"restaurant_profile","name":"Restaurant Profile"},{"key":"order_settings","name":"Order Settings"},{"key":"devices","name":"Devices"},{"key":"printing","name":"Printing"},{"key":"integrations","name":"Integrations"},{"key":"subscription","name":"Subscription"},{"key":"data_readiness","name":"Data Readiness"}]'::jsonb,
   true, 100)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- Seed: enable every module for every existing organization (default on).
-- ----------------------------------------------------------------------------

insert into public.org_modules (organization_id, module_key, enabled)
select o.id, m.key, true
from public.organizations o
cross join public.modules m
on conflict (organization_id, module_key) do nothing;

-- ----------------------------------------------------------------------------
-- Seed: platform workflow templates (organization_id NULL = all orgs).
-- ----------------------------------------------------------------------------

-- ON CONFLICT cannot dedupe these: organization_id is NULL and NULLs are
-- distinct under the unique constraint, so guard with NOT EXISTS instead.
insert into public.org_workflows (organization_id, key, name, module, version, definition)
select *
from ( values
  (null::uuid, 'full_service', 'Full Service Dining', 'orders', 1,
   '{"nodes": [
      {"id": "start",   "type": "start",    "data": {"label": "Start"}},
      {"id": "captain", "type": "task",     "data": {"label": "Captain takes order", "role": "captain"}},
      {"id": "kot",     "type": "action",   "data": {"label": "KOT generated"}},
      {"id": "kitchen", "type": "task",     "data": {"label": "Kitchen prepares", "role": "kitchen"}},
      {"id": "ready",   "type": "state",    "data": {"label": "Ready to serve"}},
      {"id": "bill",    "type": "task",     "data": {"label": "Bill generated", "role": "biller"}},
      {"id": "payment", "type": "task",     "data": {"label": "Payment collected", "role": "biller"}},
      {"id": "end",     "type": "end",      "data": {"label": "Completed"}}
    ],
    "edges": [
      {"from": "start",   "to": "captain"},
      {"from": "captain", "to": "kot"},
      {"from": "kot",     "to": "kitchen"},
      {"from": "kitchen", "to": "ready"},
      {"from": "ready",   "to": "bill"},
      {"from": "bill",    "to": "payment"},
      {"from": "payment", "to": "end"}
    ]}'::jsonb),
  (null, 'counter_service', 'Counter Service / QSR', 'orders', 1,
   '{"nodes": [
      {"id": "start",   "type": "start",  "data": {"label": "Start"}},
      {"id": "order",   "type": "task",   "data": {"label": "Order placed at counter", "role": "biller"}},
      {"id": "payment", "type": "task",   "data": {"label": "Payment collected", "role": "biller"}},
      {"id": "kot",     "type": "action", "data": {"label": "KOT generated"}},
      {"id": "ready",   "type": "state",  "data": {"label": "Ready for pickup"}},
      {"id": "end",     "type": "end",    "data": {"label": "Completed"}}
    ],
    "edges": [
      {"from": "start",   "to": "order"},
      {"from": "order",   "to": "payment"},
      {"from": "payment", "to": "kot"},
      {"from": "kot",     "to": "ready"},
      {"from": "ready",   "to": "end"}
    ]}'::jsonb),
  -- As applied to the remote database, this third template exists alongside
  -- the two above. Its definition uses the flat editor shape (nodes carry a
  -- top-level "label" instead of data.label); the shape check below only
  -- requires nodes/edges arrays, and lib/tenant.ts normalizes both styles.
  (null, 'qr_ordering', 'QR Ordering', 'orders', 1,
   '{"nodes": [
      {"id": "trigger",   "type": "trigger", "label": "QR Order"},
      {"id": "payment",   "type": "step",    "label": "Payment"},
      {"id": "kot",       "type": "step",    "label": "KOT"},
      {"id": "ready",     "type": "step",    "label": "Ready"},
      {"id": "table",     "type": "step",    "label": "Table"},
      {"id": "completed", "type": "end",     "label": "Completed"}
    ],
    "edges": [
      {"from": "trigger", "to": "payment"},
      {"from": "payment", "to": "kot"},
      {"from": "kot",     "to": "ready"},
      {"from": "ready",   "to": "table"},
      {"from": "table",   "to": "completed"}
    ]}'::jsonb)
) as seed (organization_id, key, name, module, version, definition)
where not exists (
  select 1 from public.org_workflows w
  where w.organization_id is null
    and w.key = seed.key
    and w.version = seed.version
);
