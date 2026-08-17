-- ============================================================================
-- 0002 — Role grants for 0001
--
-- 0001 created its tables but never granted table privileges to the Supabase
-- roles, so PostgREST returned 42501 "permission denied" before RLS was ever
-- consulted. Grants and RLS are two independent gates: a role needs the GRANT
-- to reach the table, and then must satisfy the policy to see any rows.
--
-- `anon` is deliberately granted nothing. Nobody unauthenticated reads
-- organizations.
-- ============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- organizations
--
-- `authenticated` still passes through the RLS policies from 0001, which today
-- means platform admins only. service_role bypasses RLS by design and is used
-- for server-side administrative reads.
-- ----------------------------------------------------------------------------

grant select, insert, update on public.organizations to authenticated;
grant all privileges          on public.organizations to service_role;

-- No delete grant to anyone: organizations are suspended via `status`, never
-- hard-deleted, because orders and payments will reference them.

-- ----------------------------------------------------------------------------
-- platform_admins
-- ----------------------------------------------------------------------------

grant select         on public.platform_admins to authenticated;
grant all privileges on public.platform_admins to service_role;

-- ----------------------------------------------------------------------------
-- Helper function
--
-- Policies call this as the invoking role, so the role must be able to execute
-- it. It is SECURITY DEFINER, so this does not leak the platform_admins table.
-- ----------------------------------------------------------------------------

grant execute on function public.is_platform_admin() to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Default privileges for everything added from here on.
--
-- Applies only to objects created by this role in future migrations, so each
-- later migration still states its own grants explicitly rather than relying
-- on this alone.
-- ----------------------------------------------------------------------------

alter default privileges in schema public
  grant select, insert, update on tables to authenticated;

alter default privileges in schema public
  grant all privileges on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
