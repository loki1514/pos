# Vini POS — database

Migrations are plain SQL, applied with the Supabase CLI. They are numbered in
build order and are **append-only** — never edit a migration that has been
applied; add a new one.

| Migration | Status | Covers |
|---|---|---|
| `0001_organizations.sql` | written, **not applied** | `organizations`, `org_type`/`org_status` enums, `platform_admins`, RLS |
| `0002_locations.sql` | not written | Organization Locations |
| `0003_roles_and_users.sql` | not written | Roles, org membership, org-scoped RLS |
| `0004_org_config.sql` | not written | Organization + workflow configuration |

## Applying

Requires `SUPABASE_DB_URL` in the repo-root `.env.local` (Supabase Dashboard →
Project Settings → Database → Connection string). It is currently blank.

```bash
supabase db push --db-url "$SUPABASE_DB_URL"
```

Or apply a single file directly:

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_organizations.sql
```

## After 0001 is applied

`organizations` is RLS-protected and only `platform_admins` can read or write
it. The Vini super admin must therefore exist as a Supabase Auth user **and**
have a row in `platform_admins`, or the admin console will read zero rows.

Create the auth user in the Dashboard (Authentication → Users → Add user) with
the email from `MASTER_ADMIN_EMAIL`, then:

```sql
insert into public.platform_admins (user_id, email)
select id, email from auth.users where email = 'vinipos.mas-admin@vinipos.com';
```

Until that is done, the master admin console keeps rendering
`apps/web/src/lib/mock-data.ts`.

## Notes

- Organizations are **suspended**, never deleted — there is no DELETE policy.
- `organizations.settings` is a transitional JSONB blob; structured config
  tables replace it in 0004.
- Every org-scoped table added later must enable RLS in the same migration that
  creates it. Deny-by-default is the rule.
