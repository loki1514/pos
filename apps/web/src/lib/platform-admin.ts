import "server-only";
import { supabaseServer } from "@/lib/supabase-server";

export type PlatformAdmin = { id: string; email: string };

/**
 * The Vini super admin, resolved from a real Supabase Auth session — not the
 * env-var credential this used to be. `is_platform_admin()` (migration 0001)
 * is SECURITY DEFINER, so this call is authoritative even though the caller
 * only has an `authenticated`-role session, not service_role.
 */
export async function getPlatformAdmin(): Promise<PlatformAdmin | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: isAdmin, error } = await supabase.rpc("is_platform_admin");
  if (error) throw new Error(`getPlatformAdmin: ${error.message}`);
  if (!isAdmin) return null;

  return { id: user.id, email: user.email };
}

export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const admin = await getPlatformAdmin();
  if (!admin) throw new Error("You don't have permission to do this.");
  return admin;
}
