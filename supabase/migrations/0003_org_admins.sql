-- ============================================================================
-- 0003 — Organization admins
--
-- The minimal membership slice pulled forward from Phase 2 (Roles/Users):
-- just enough to give a newly created organization one logged-in admin.
-- Full org_users + role assignment still belongs to Phase 2; this table is
-- deliberately narrow — one row per (org, auth user), role fixed at
-- 'org_admin' for now.
-- ============================================================================

create table public.org_admins (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  email           text not null,
  created_at      timestamptz not null default now(),

  constraint org_admins_org_user_unique unique (organization_id, user_id)
);

comment on table public.org_admins is
  'One admin login per organization, created at organization creation time. Superseded by org_users + roles in Phase 2.';

create index org_admins_organization_id_idx
  on public.org_admins (organization_id);

alter table public.org_admins enable row level security;

-- Same access shape as organizations itself in 0001: platform admins manage
-- everything, and org admins can see their own membership row.
create policy org_admins_platform_admin_all
  on public.org_admins
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy org_admins_self_select
  on public.org_admins
  for select
  using (user_id = auth.uid());

grant select on public.org_admins to authenticated;
grant all privileges on public.org_admins to service_role;

-- ----------------------------------------------------------------------------
-- Let an org admin read their own organization row.
--
-- 0001 deliberately shipped without member access because no membership
-- table existed yet. This is that policy, now that org_admins exists.
-- ----------------------------------------------------------------------------

create policy organizations_member_select
  on public.organizations
  for select
  using (
    exists (
      select 1 from public.org_admins
      where org_admins.organization_id = organizations.id
        and org_admins.user_id = auth.uid()
    )
  );
