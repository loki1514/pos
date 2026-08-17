-- ============================================================================
-- 0001 — Organizations
--
-- The root entity of Vini POS. Everything else (locations, users, roles,
-- config, workflows, orders) hangs off an organization, so this migration
-- also establishes the tenancy boundary that every later table inherits.
--
-- Build order: Phase 1 — Vini Super Admin → Create Organization.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

-- Organization TYPE, not a separate application. Both types run the same
-- modules; they differ only in commercial relationship.
create type public.org_type as enum ('franchise', 'investor');

create type public.org_status as enum ('onboarding', 'active', 'suspended');

-- ----------------------------------------------------------------------------
-- Platform admins
--
-- The Vini super admin exists BEFORE any organization does, so it cannot be
-- org-scoped. This table is the allow-list that organization policies check.
-- ----------------------------------------------------------------------------

create table public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now()
);

comment on table public.platform_admins is
  'Vini staff with platform-wide access. Not org-scoped.';

alter table public.platform_admins enable row level security;

-- SECURITY DEFINER so policies can consult this table without the caller
-- needing read access to it (which would otherwise cause policy recursion).
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = auth.uid()
  );
$$;

comment on function public.is_platform_admin() is
  'True when the current JWT belongs to a Vini platform admin.';

-- Platform admins can see the roster; nobody else can.
create policy platform_admins_select
  on public.platform_admins
  for select
  using (public.is_platform_admin());

-- ----------------------------------------------------------------------------
-- Organizations
-- ----------------------------------------------------------------------------

create table public.organizations (
  id             uuid primary key default gen_random_uuid(),

  name           text not null,
  -- URL-safe identifier; becomes the org's subdomain / path segment.
  slug           text not null,

  type           public.org_type   not null,
  status         public.org_status not null default 'onboarding',

  legal_name     text,
  gstin          text,
  contact_email  text,
  contact_phone  text,

  -- Free-form org configuration (enabled modules, workflow selection).
  -- Promoted to real columns/tables as those screens are built (0004).
  settings       jsonb not null default '{}'::jsonb,

  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint organizations_name_not_blank
    check (length(btrim(name)) > 0),

  constraint organizations_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 63),

  constraint organizations_contact_email_format
    check (contact_email is null or contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),

  -- 15-character GSTIN, validated on shape only.
  constraint organizations_gstin_format
    check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]$')
);

comment on table public.organizations is
  'Root tenant entity. Purchased by a franchise or an investor; configures its own locations, users, roles and workflows.';
comment on column public.organizations.settings is
  'Transitional config blob. Structured tables replace this as config screens ship.';

create unique index organizations_slug_key
  on public.organizations (slug);

create index organizations_status_idx
  on public.organizations (status);

create index organizations_type_idx
  on public.organizations (type);

create index organizations_created_at_idx
  on public.organizations (created_at desc);

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row level security
--
-- At 0001 only platform admins have access, because organization membership
-- does not exist yet — it arrives in 0003 (roles + org_users). When it does,
-- an additional SELECT policy grants members read access to their own org.
-- Deny-by-default until then: no policy means no access.
-- ----------------------------------------------------------------------------

alter table public.organizations enable row level security;

create policy organizations_platform_admin_select
  on public.organizations
  for select
  using (public.is_platform_admin());

create policy organizations_platform_admin_insert
  on public.organizations
  for insert
  with check (public.is_platform_admin());

create policy organizations_platform_admin_update
  on public.organizations
  for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Deliberately no DELETE policy. Organizations are suspended via `status`,
-- never hard-deleted — orders and payments reference them.
