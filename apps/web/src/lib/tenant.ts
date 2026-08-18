// TEMP STUB — overwritten by cp-data merge
// This file exists only so the cp-modules admin UI can build and typecheck
// against the control-plane data contract. The real implementation (Supabase
// queries against modules / org_modules / org_domains from migration 0007) is
// being built on the data branch and REPLACES this file at merge time.
import "server-only";

export type Module = {
  key: string;
  name: string;
  group: string;
  is_core: boolean;
  submodules: string[];
  sort_order: number;
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

const NOT_WIRED = "tenant.ts stub: control-plane data layer is not wired yet";

export async function listModules(): Promise<Module[]> {
  throw new Error(NOT_WIRED);
}

export async function listOrgModules(
  organizationId: string,
): Promise<(Module & { enabled: boolean })[]> {
  void organizationId;
  throw new Error(NOT_WIRED);
}

export async function setOrgModule(
  organizationId: string,
  moduleKey: string,
  enabled: boolean,
): Promise<void> {
  void organizationId;
  void moduleKey;
  void enabled;
  throw new Error(NOT_WIRED);
}

export async function listOrgDomains(
  organizationId: string,
): Promise<OrgDomain[]> {
  void organizationId;
  throw new Error(NOT_WIRED);
}

export async function addOrgDomain(
  organizationId: string,
  domain: string,
  kind: "subdomain" | "custom",
): Promise<void> {
  void organizationId;
  void domain;
  void kind;
  throw new Error(NOT_WIRED);
}

export async function removeOrgDomain(id: string): Promise<void> {
  void id;
  throw new Error(NOT_WIRED);
}

export async function markDomainVerified(id: string): Promise<void> {
  void id;
  throw new Error(NOT_WIRED);
}

export async function listModulesWithOrgCounts(): Promise<
  (Module & { orgsEnabled: number })[]
> {
  throw new Error(NOT_WIRED);
}
