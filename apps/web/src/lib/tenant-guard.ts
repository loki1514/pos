import "server-only";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type TenantCheck =
  | { status: "ok" }
  /** Host resolves to a different org than the signed-in user belongs to. */
  | {
      status: "mismatch";
      hostOrgName: string;
      userOrgName: string;
      /** Primary hostname for the user's own org, for the "go there" link. */
      userOrgHost: string | null;
    };

/**
 * Cross-checks the hostname against the session.
 *
 * proxy.ts resolves the request Host to an organization and stamps x-org-id.
 * Until now nothing read it, so visiting apple.vinipos.com while signed in as
 * a Saffron House user would silently serve Saffron House data under Apple's
 * domain. This is the consumer that closes that.
 *
 * Returns "ok" when the header is absent — localhost, the bare platform
 * domain and preview deploys never resolve to a tenant, and a user reaching
 * /org through those is the normal development path.
 */
export async function checkTenantHost(
  userOrgId: string,
  userOrgName: string,
): Promise<TenantCheck> {
  const h = await headers();
  const hostOrgId = h.get("x-org-id");

  // No tenant host in play, or it matches — nothing to do.
  if (!hostOrgId || hostOrgId === userOrgId) return { status: "ok" };

  // Mismatch. Look up both sides so the screen can name them rather than
  // showing opaque ids.
  const [hostOrg, userDomain] = await Promise.all([
    supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", hostOrgId)
      .maybeSingle(),
    supabaseAdmin
      .from("org_domains")
      .select("domain")
      .eq("organization_id", userOrgId)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    status: "mismatch",
    hostOrgName: hostOrg.data?.name ?? "another organization",
    userOrgName,
    userOrgHost: userDomain.data?.domain ?? null,
  };
}
