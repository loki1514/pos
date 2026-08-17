import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Cookie-backed Supabase client for org-scoped auth. This is a genuine
 * Supabase Auth session (unlike the super admin's env-var cookie in
 * src/lib/auth.ts) — RLS policies like `organizations_member_select` and
 * `org_admins_self_select` (migration 0003) run as this user, not as
 * service_role.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render — the session refresh
            // is handled by proxy.ts instead. Safe to ignore.
          }
        },
      },
    },
  );
}
