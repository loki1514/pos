import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only client using the service_role key — bypasses RLS by design.
 *
 * This is the Vini super admin's data path: a platform admin legitimately
 * needs cross-tenant reads, which is what service_role is for. Never import
 * this from a Client Component or route that isn't behind the /admin auth
 * gate (see src/proxy.ts) — the `server-only` import throws at build time if
 * that happens by accident.
 *
 * Org-scoped app code (Phase 2+) uses the anon key + Supabase Auth instead,
 * so RLS actually enforces tenant isolation there.
 */
function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Check .env.local.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabaseAdmin = client();
