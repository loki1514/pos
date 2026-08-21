-- ============================================================================
-- 0008 — Role → module visibility
--
-- 0007 answered "does this organization have the module at all".
-- This answers "and which roles inside that organization may see it".
--
-- Effective visibility is the INTERSECTION:
--     org_modules.enabled  AND  role_module_access
-- A captain at an org with Inventory switched on still doesn't see Inventory.
--
-- Scoping follows the org_workflows convention from 0007:
--     organization_id NULL → platform default for that role
--     organization_id uuid → that organization's override
-- An org row wins over the platform row for the same (role, module).
-- ============================================================================

create table public.role_module_access (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  role_id         uuid not null references public.roles (id) on delete cascade,
  module_key      text not null references public.modules (key) on delete cascade,
  visible         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- PG15+ `nulls not distinct` so the platform-default row (NULL org) is
  -- genuinely unique per (role, module) instead of being duplicable.
  constraint role_module_access_scope_unique
    unique nulls not distinct (organization_id, role_id, module_key)
);

comment on table public.role_module_access is
  'Which roles may see which modules. organization_id NULL is the platform default; a row with an organization_id overrides it for that org.';

create index role_module_access_role_idx on public.role_module_access (role_id);
create index role_module_access_org_idx on public.role_module_access (organization_id);

create trigger role_module_access_set_updated_at
  before update on public.role_module_access
  for each row execute function public.set_updated_at();

alter table public.role_module_access enable row level security;

create policy role_module_access_platform_admin_all
  on public.role_module_access for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Members read the rules that apply to them: platform defaults plus their own
-- organization's overrides. They never write — the platform admin (and later
-- an org admin, through a server action) owns these.
create policy role_module_access_member_select
  on public.role_module_access for select
  using (
    organization_id is null
    or organization_id = public.current_org_id()
  );

grant select on public.role_module_access to authenticated;
grant all privileges on public.role_module_access to service_role;

-- ----------------------------------------------------------------------------
-- Platform defaults
--
-- Derived from what each role actually does on shift, not from seniority:
--   org_admin / manager  run the business        → everything
--   biller               takes money             → orders, POS, menu
--   captain              works the floor         → orders, menu
--   kitchen              works the pass          → KDS/KOT, menu
--
-- Dashboard is given to everyone as the landing screen. Staff, Settings,
-- Inventory, Finance and Marketing stay with admin/manager by default; an org
-- can override any of this per role.
-- ----------------------------------------------------------------------------

insert into public.role_module_access (organization_id, role_id, module_key, visible)
select null, r.id, m.key, true
from public.roles r
cross join public.modules m
where r.slug in ('org_admin', 'manager')
on conflict do nothing;

insert into public.role_module_access (organization_id, role_id, module_key, visible)
select null, r.id, m.key, true
from public.roles r
cross join public.modules m
where r.slug = 'biller'
  and m.key in ('dashboard', 'orders', 'pos', 'menu')
on conflict do nothing;

insert into public.role_module_access (organization_id, role_id, module_key, visible)
select null, r.id, m.key, true
from public.roles r
cross join public.modules m
where r.slug = 'captain'
  and m.key in ('dashboard', 'orders', 'menu')
on conflict do nothing;

insert into public.role_module_access (organization_id, role_id, module_key, visible)
select null, r.id, m.key, true
from public.roles r
cross join public.modules m
where r.slug = 'kitchen'
  and m.key in ('dashboard', 'kds_kot', 'menu')
on conflict do nothing;
