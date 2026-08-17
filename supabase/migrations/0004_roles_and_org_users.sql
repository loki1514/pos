-- ============================================================================
-- 0004 — Roles and organization users
--
-- Replaces the narrow `org_admins` stopgap from 0003 with the real membership
-- model: a user belongs to an organization *with a role*. This is what the
-- org admin dashboard uses to manage its own staff.
--
-- Location scoping is deliberately NOT here — locations do not exist yet
-- (Phase 1 #6). `org_users.location_id` gets added when they do; membership
-- is organization-wide until then.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Roles
--
-- System roles ship with the platform. Organizations may add their own later
-- (is_system = false), which is why this is a table and not an enum.
-- ----------------------------------------------------------------------------

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),

  constraint roles_slug_format check (slug ~ '^[a-z0-9]+(_[a-z0-9]+)*$')
);

comment on table public.roles is
  'Operational roles. System roles are platform-wide; organizations may define their own later.';

insert into public.roles (slug, name, description, is_system) values
  ('org_admin', 'Organization Admin', 'Full control of the organization: users, roles, configuration.', true),
  ('manager',   'Manager',            'Operational oversight, configuration and analytics.',                true),
  ('biller',    'Biller / POS',       'Creates and manages orders, billing and payments.',                  true),
  ('captain',   'Captain',            'Mobile-first table ordering and order status.',                      true),
  ('kitchen',   'KOT / Kitchen',      'Receives orders, prepares them, marks ready, raises stock alerts.',  true);

alter table public.roles enable row level security;

-- Roles are reference data — any signed-in user may read them.
create policy roles_read on public.roles for select to authenticated using (true);

grant select on public.roles to authenticated;
grant all privileges on public.roles to service_role;

-- ----------------------------------------------------------------------------
-- Organization membership
-- ----------------------------------------------------------------------------

create type public.member_status as enum ('active', 'suspended');

create table public.org_users (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role_id         uuid not null references public.roles (id),
  email           text not null,
  full_name       text,
  status          public.member_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint org_users_org_user_unique unique (organization_id, user_id)
);

comment on table public.org_users is
  'Who belongs to which organization, and in what role. Location scoping arrives with Phase 1 #6.';

create index org_users_organization_id_idx on public.org_users (organization_id);
create index org_users_user_id_idx on public.org_users (user_id);

create trigger org_users_set_updated_at
  before update on public.org_users
  for each row execute function public.set_updated_at();

-- Carry the 0003 admins over before that table goes away.
insert into public.org_users (organization_id, user_id, role_id, email, created_at)
select a.organization_id, a.user_id, r.id, a.email, a.created_at
from public.org_admins a
cross join lateral (select id from public.roles where slug = 'org_admin') r;

-- ----------------------------------------------------------------------------
-- Membership helpers
--
-- SECURITY DEFINER so policies can consult org_users without the caller
-- needing direct read access — otherwise the policy on org_users would
-- recurse into itself.
-- ----------------------------------------------------------------------------

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select organization_id
  from public.org_users
  where user_id = auth.uid() and status = 'active'
  limit 1;
$$;

create or replace function public.is_org_admin(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.org_users u
    join public.roles r on r.id = u.role_id
    where u.user_id = auth.uid()
      and u.organization_id = org
      and u.status = 'active'
      and r.slug = 'org_admin'
  );
$$;

grant execute on function public.current_org_id() to authenticated, service_role;
grant execute on function public.is_org_admin(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table public.org_users enable row level security;

create policy org_users_platform_admin_all
  on public.org_users for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Any member may see who else is in their organization.
create policy org_users_member_select
  on public.org_users for select
  using (organization_id = public.current_org_id());

-- Only an org admin may add, change or remove members.
create policy org_users_admin_insert
  on public.org_users for insert
  with check (public.is_org_admin(organization_id));

create policy org_users_admin_update
  on public.org_users for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy org_users_admin_delete
  on public.org_users for delete
  using (public.is_org_admin(organization_id));

grant select, insert, update, delete on public.org_users to authenticated;
grant all privileges on public.org_users to service_role;

-- ----------------------------------------------------------------------------
-- Point organizations at the new membership table, then drop the stopgap.
-- ----------------------------------------------------------------------------

drop policy if exists organizations_member_select on public.organizations;

create policy organizations_member_select
  on public.organizations for select
  using (
    exists (
      select 1 from public.org_users u
      where u.organization_id = organizations.id
        and u.user_id = auth.uid()
        and u.status = 'active'
    )
  );

-- An org admin may edit their own organization's profile.
create policy organizations_admin_update
  on public.organizations for update
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

drop table public.org_admins;
