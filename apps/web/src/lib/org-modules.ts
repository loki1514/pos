import "server-only";
import { listModules, listOrgModules } from "@/lib/tenant";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Modules an organization has switched on (migration 0007).
 *
 *   - a row in org_modules decides it (enabled true/false)
 *   - no row + is_core  → on  (the platform guarantees core modules)
 *   - no row + optional → off (absence means "not available to this org")
 */
async function orgEnabledKeys(orgId: string): Promise<Set<string>> {
  const [catalog, toggles] = await Promise.all([
    listModules(),
    listOrgModules(orgId),
  ]);

  const byKey = new Map(toggles.map((t) => [t.module_key, t]));

  return new Set(
    catalog
      .filter((m) => byKey.get(m.key)?.enabled ?? m.is_core)
      .map((m) => m.key),
  );
}

/**
 * Modules a role may see (migration 0008). An organization-scoped row
 * overrides the platform default for the same (role, module).
 */
async function roleVisibleKeys(
  orgId: string,
  roleSlug: string,
): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from("role_module_access")
    .select("module_key, visible, organization_id, roles!inner(slug)")
    .eq("roles.slug", roleSlug)
    .or(`organization_id.is.null,organization_id.eq.${orgId}`);

  if (error) throw new Error(`roleVisibleKeys: ${error.message}`);

  // Org-scoped rows win over platform defaults for the same module.
  const resolved = new Map<string, boolean>();
  for (const row of data ?? []) {
    const isOrgRow = row.organization_id !== null;
    if (isOrgRow || !resolved.has(row.module_key)) {
      resolved.set(row.module_key, row.visible);
    }
  }

  return new Set(
    [...resolved.entries()].filter(([, visible]) => visible).map(([key]) => key),
  );
}

/**
 * What this specific user actually sees: the intersection of what the
 * organization has switched on and what their role is allowed.
 *
 * A captain at an org with Inventory enabled still gets no Inventory —
 * both gates must pass.
 *
 * Returns null if the control-plane tables aren't there yet, which the
 * sidebar reads as "show everything" — an unapplied migration should not
 * blank out someone's navigation.
 */
export async function getEnabledModuleKeys(
  orgId: string,
  roleSlug?: string,
): Promise<Set<string> | null> {
  try {
    const orgKeys = await orgEnabledKeys(orgId);
    if (!roleSlug) return orgKeys;

    const roleKeys = await roleVisibleKeys(orgId, roleSlug);

    // No rules configured for this role at all → fall back to the org's set
    // rather than showing an empty sidebar.
    if (roleKeys.size === 0) return orgKeys;

    return new Set([...orgKeys].filter((key) => roleKeys.has(key)));
  } catch {
    return null;
  }
}
