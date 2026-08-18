import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Control-plane data layer (migration 0007): tenant host resolution, the
 * module registry, per-organization module toggles, org domains and
 * versioned workflow templates.
 *
 * Everything here uses supabaseAdmin (service_role) — these helpers are
 * called either from middleware/proxy, where no user session exists, or from
 * platform-admin server code that has already authorized the caller. Never
 * expose them to a client component.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrgRef = {
  orgId: string;
  slug: string;
  name: string;
};

export type Module = {
  key: string;
  name: string;
  group: string | null;
  description: string | null;
  submodules: { key: string; name: string }[];
  is_core: boolean;
  sort_order: number;
};

export type OrgModule = {
  organization_id: string;
  module_key: string;
  enabled: boolean;
  config: Record<string, unknown>;
  updated_at: string;
};

export type OrgDomain = {
  id: string;
  organization_id: string;
  domain: string;
  kind: "subdomain" | "custom";
  is_primary: boolean;
  verified_at: string | null;
  created_at: string;
};

export type WorkflowNode = {
  id: string;
  type: string;
  data: Record<string, unknown>;
};

export type WorkflowEdge = {
  from: string;
  to: string;
  label?: string;
};

export type WorkflowDefinition = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export type OrgWorkflow = {
  id: string;
  organization_id: string | null;
  key: string;
  name: string;
  module: string;
  version: number;
  definition: WorkflowDefinition;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Host → organization resolution
// ---------------------------------------------------------------------------

export function platformBaseDomain(): string {
  return (process.env.PLATFORM_BASE_DOMAIN ?? "vinipos.co").toLowerCase();
}

/**
 * Splits a Host header into a bare hostname (lowercased, port stripped).
 * Returns null for anything that is not a usable hostname.
 */
export function normalizeHost(host: string): string | null {
  const bare = host.split(",")[0].trim().toLowerCase();
  // Strip a trailing port (localhost:3000) but leave IPv6 literals alone —
  // those are not tenant hosts anyway.
  const name = bare.includes("[") ? bare : bare.replace(/:\d+$/, "");
  return name.length > 0 ? name : null;
}

/**
 * Resolves a request host to an organization.
 *
 * Order of attempts:
 *   1. <slug>.<PLATFORM_BASE_DOMAIN>  → organizations.slug
 *   2. anything else                  → org_domains.domain (any kind)
 *
 * The bare platform domain, localhost and Vercel preview hosts do not belong
 * to a tenant and return null — callers fall back to platform behavior.
 */
export async function resolveHostToOrg(host: string): Promise<OrgRef | null> {
  const name = normalizeHost(host);
  if (!name) return null;

  const base = platformBaseDomain();

  if (name === base || name === `www.${base}`) return null;
  if (name === "localhost" || name.endsWith(".vercel.app")) return null;

  // 1. Platform subdomain: leftmost label is the organization slug.
  if (name === base || name.endsWith(`.${base}`)) {
    const slug = name.slice(0, name.length - base.length - 1);
    // Multi-label prefixes (a.b.vinipos.co) are not tenant slugs.
    if (!slug || slug.includes(".")) return null;

    const { data, error } = await supabaseAdmin
      .from("organizations")
      .select("id, slug, name")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error(`resolveHostToOrg: ${error.message}`);
    return data ? { orgId: data.id, slug: data.slug, name: data.name } : null;
  }

  // 2. Custom / other domain: exact match in org_domains.
  const { data, error } = await supabaseAdmin
    .from("org_domains")
    .select("domain, organizations!inner(id, slug, name)")
    .eq("domain", name)
    .maybeSingle();

  if (error) throw new Error(`resolveHostToOrg: ${error.message}`);
  if (!data) return null;

  const org = data.organizations as unknown as { id: string; slug: string; name: string };
  return { orgId: org.id, slug: org.slug, name: org.name };
}

// ---------------------------------------------------------------------------
// Module registry
// ---------------------------------------------------------------------------

export async function listModules(): Promise<Module[]> {
  const { data, error } = await supabaseAdmin
    .from("modules")
    .select("key, name, group, description, submodules, is_core, sort_order")
    .order("sort_order");

  if (error) throw new Error(`listModules: ${error.message}`);
  return (data ?? []) as Module[];
}

export async function listOrgModules(orgId: string): Promise<OrgModule[]> {
  const { data, error } = await supabaseAdmin
    .from("org_modules")
    .select("organization_id, module_key, enabled, config, updated_at")
    .eq("organization_id", orgId)
    .order("module_key");

  if (error) throw new Error(`listOrgModules: ${error.message}`);
  return (data ?? []) as OrgModule[];
}

/**
 * Platform-admin path: enable or disable a module for an organization.
 * Core modules (is_core) can never be disabled — the platform guarantees
 * them to every org.
 */
export async function setOrgModuleEnabled(
  orgId: string,
  moduleKey: string,
  enabled: boolean,
): Promise<void> {
  if (!enabled) {
    const { data: mod, error } = await supabaseAdmin
      .from("modules")
      .select("is_core")
      .eq("key", moduleKey)
      .maybeSingle();

    if (error) throw new Error(`setOrgModuleEnabled: ${error.message}`);
    if (!mod) throw new Error(`setOrgModuleEnabled: unknown module "${moduleKey}".`);
    if (mod.is_core) {
      throw new Error(`setOrgModuleEnabled: "${moduleKey}" is a core module and cannot be disabled.`);
    }
  }

  const { error } = await supabaseAdmin
    .from("org_modules")
    .upsert(
      { organization_id: orgId, module_key: moduleKey, enabled },
      { onConflict: "organization_id,module_key" },
    );

  if (error) throw new Error(`setOrgModuleEnabled: ${error.message}`);
}

export async function updateOrgModuleConfig(
  orgId: string,
  moduleKey: string,
  config: Record<string, unknown>,
): Promise<void> {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("updateOrgModuleConfig: config must be a plain object.");
  }

  const { error } = await supabaseAdmin
    .from("org_modules")
    .upsert(
      { organization_id: orgId, module_key: moduleKey, config },
      { onConflict: "organization_id,module_key" },
    );

  if (error) throw new Error(`updateOrgModuleConfig: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Organization domains
// ---------------------------------------------------------------------------

const DOMAIN_RE = /^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$/;

export async function listOrgDomains(orgId: string): Promise<OrgDomain[]> {
  const { data, error } = await supabaseAdmin
    .from("org_domains")
    .select("id, organization_id, domain, kind, is_primary, verified_at, created_at")
    .eq("organization_id", orgId)
    .order("created_at");

  if (error) throw new Error(`listOrgDomains: ${error.message}`);
  return (data ?? []) as OrgDomain[];
}

export async function addOrgDomain(
  orgId: string,
  domain: string,
  kind: "subdomain" | "custom" = "custom",
): Promise<OrgDomain> {
  const normalized = domain.trim().toLowerCase();
  if (kind !== "subdomain" && kind !== "custom") {
    throw new Error(`addOrgDomain: kind must be "subdomain" or "custom".`);
  }
  if (!DOMAIN_RE.test(normalized)) {
    throw new Error(`addOrgDomain: "${domain}" is not a valid domain name.`);
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("org_domains")
    .select("id, organization_id")
    .eq("domain", normalized)
    .maybeSingle();

  if (lookupError) throw new Error(`addOrgDomain: ${lookupError.message}`);
  if (existing) {
    throw new Error(
      existing.organization_id === orgId
        ? `addOrgDomain: "${normalized}" is already registered to this organization.`
        : `addOrgDomain: "${normalized}" is already registered to another organization.`,
    );
  }

  const { data, error } = await supabaseAdmin
    .from("org_domains")
    .insert({ organization_id: orgId, domain: normalized, kind })
    .select("id, organization_id, domain, kind, is_primary, verified_at, created_at")
    .single();

  if (error) throw new Error(`addOrgDomain: ${error.message}`);
  return data as OrgDomain;
}

export async function removeOrgDomain(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("org_domains").delete().eq("id", id);
  if (error) throw new Error(`removeOrgDomain: ${error.message}`);
}

export async function markOrgDomainVerified(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("org_domains")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`markOrgDomainVerified: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

/**
 * Zod-less structural validation of a workflow definition:
 * { nodes: [{id, type, data}], edges: [{from, to, label?}] }.
 * Also checks edge endpoints reference declared nodes. Throws on the first
 * problem found; returns the (typed) definition on success.
 */
export function validateWorkflowDefinition(input: unknown): WorkflowDefinition {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Workflow definition must be an object.");
  }
  const def = input as { nodes?: unknown; edges?: unknown };

  if (!Array.isArray(def.nodes)) throw new Error("Workflow definition: nodes must be an array.");
  if (!Array.isArray(def.edges)) throw new Error("Workflow definition: edges must be an array.");

  const nodeIds = new Set<string>();
  const nodes: WorkflowNode[] = def.nodes.map((raw, i) => {
    const n = raw as Partial<WorkflowNode>;
    if (!n || typeof n !== "object") throw new Error(`nodes[${i}] must be an object.`);
    if (typeof n.id !== "string" || n.id.length === 0) throw new Error(`nodes[${i}].id must be a non-empty string.`);
    if (typeof n.type !== "string" || n.type.length === 0) throw new Error(`nodes[${i}].type must be a non-empty string.`);
    if (n.data === undefined || n.data === null || typeof n.data !== "object" || Array.isArray(n.data)) {
      throw new Error(`nodes[${i}].data must be an object.`);
    }
    if (nodeIds.has(n.id)) throw new Error(`Duplicate node id "${n.id}".`);
    nodeIds.add(n.id);
    return { id: n.id, type: n.type, data: n.data as Record<string, unknown> };
  });

  const edges: WorkflowEdge[] = def.edges.map((raw, i) => {
    const e = raw as Partial<WorkflowEdge>;
    if (!e || typeof e !== "object") throw new Error(`edges[${i}] must be an object.`);
    if (typeof e.from !== "string" || !nodeIds.has(e.from)) {
      throw new Error(`edges[${i}].from must reference a declared node.`);
    }
    if (typeof e.to !== "string" || !nodeIds.has(e.to)) {
      throw new Error(`edges[${i}].to must reference a declared node.`);
    }
    if (e.label !== undefined && typeof e.label !== "string") {
      throw new Error(`edges[${i}].label must be a string when present.`);
    }
    return e.label === undefined ? { from: e.from, to: e.to } : { from: e.from, to: e.to, label: e.label };
  });

  return { nodes, edges };
}

/** Platform templates: organization_id IS NULL, shared by every org. */
export async function listWorkflowTemplates(): Promise<OrgWorkflow[]> {
  const { data, error } = await supabaseAdmin
    .from("org_workflows")
    .select("*")
    .is("organization_id", null)
    .order("key")
    .order("version", { ascending: false });

  if (error) throw new Error(`listWorkflowTemplates: ${error.message}`);
  return (data ?? []) as OrgWorkflow[];
}

export async function listOrgWorkflows(orgId: string): Promise<OrgWorkflow[]> {
  const { data, error } = await supabaseAdmin
    .from("org_workflows")
    .select("*")
    .eq("organization_id", orgId)
    .order("key")
    .order("version", { ascending: false });

  if (error) throw new Error(`listOrgWorkflows: ${error.message}`);
  return (data ?? []) as OrgWorkflow[];
}

export type SaveWorkflowInput = {
  /** Existing workflow id → saves a NEW version of the same key. Omit to create key/version 1. */
  id?: string;
  /** null = platform template (platform admin only). */
  organizationId: string | null;
  key: string;
  name: string;
  module?: string;
  definition: unknown;
  /** Explicit version; ignored when `id` is given (bumps that workflow's latest instead). */
  version?: number;
};

/**
 * Version-bump save. Editing a workflow never mutates the row in place —
 * in-flight workflow_runs hold workflow_version, so every save inserts a new
 * row with the next version for (organization_id, key).
 */
export async function saveWorkflow(input: SaveWorkflowInput): Promise<OrgWorkflow> {
  const definition = validateWorkflowDefinition(input.definition);

  let version = input.version ?? 1;
  let key = input.key;
  let organizationId = input.organizationId;

  if (input.id) {
    const { data: existing, error } = await supabaseAdmin
      .from("org_workflows")
      .select("organization_id, key, version")
      .eq("id", input.id)
      .single();

    if (error) throw new Error(`saveWorkflow: ${error.message}`);
    key = existing.key;
    organizationId = existing.organization_id;

    const latestQuery = supabaseAdmin
      .from("org_workflows")
      .select("version")
      .eq("key", key)
      .order("version", { ascending: false })
      .limit(1);

    const { data: latest, error: latestError } = existing.organization_id === null
      ? await latestQuery.is("organization_id", null)
      : await latestQuery.eq("organization_id", existing.organization_id);

    if (latestError) throw new Error(`saveWorkflow: ${latestError.message}`);
    version = (latest?.[0]?.version ?? existing.version) + 1;
  }

  const { data, error } = await supabaseAdmin
    .from("org_workflows")
    .insert({
      organization_id: organizationId,
      key,
      name: input.name,
      module: input.module ?? "orders",
      version,
      definition,
    })
    .select("*")
    .single();

  if (error) throw new Error(`saveWorkflow: ${error.message}`);
  return data as OrgWorkflow;
}

export async function setWorkflowActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabaseAdmin
    .from("org_workflows")
    .update({ is_active: active })
    .eq("id", id);

  if (error) throw new Error(`setWorkflowActive: ${error.message}`);
}

export async function deleteWorkflow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("org_workflows").delete().eq("id", id);
  if (error) throw new Error(`deleteWorkflow: ${error.message}`);
}
