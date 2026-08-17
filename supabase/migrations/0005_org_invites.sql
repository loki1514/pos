-- ============================================================================
-- 0005 — Organization invite links (Phase 5: Roles)
--
-- A super admin generates a single-use signup link for an organization and a
-- role. The invitee opens it, sets their name/email/password, and lands in
-- org_users with that role — then signs in through the universal login.
--
-- The roles themselves (biller, captain, kitchen, manager, org_admin) already
-- ship in 0004 as system roles; this migration adds only the onboarding
-- mechanism. Links are single-use and expire — a leaked link dies on its own.
-- ============================================================================

create table public.org_invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role_id         uuid not null references public.roles (id),
  token           text not null unique,
  created_by      text not null,           -- super admin email (env-credential account)
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  accepted_email  text,
  created_at      timestamptz not null default now()
);

comment on table public.org_invites is
  'Single-use, expiring signup links. Acceptance happens server-side via service_role; no authenticated client ever reads this table.';

create index org_invites_organization_id_idx on public.org_invites (organization_id);

alter table public.org_invites enable row level security;

-- Platform admin (dashboard) can see and manage invites. Everyone else goes
-- through server actions that use service_role — no authenticated policy.
create policy org_invites_platform_admin_all
  on public.org_invites for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant all privileges on public.org_invites to service_role;
