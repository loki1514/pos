"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import {
  addOrgDomain,
  markOrgDomainVerified,
  removeOrgDomain,
  setOrgModuleEnabled,
} from "@/lib/tenant";

export type ModuleToggleState = { ok: boolean; error: string | null };

export async function setOrgModuleAction(
  organizationId: string,
  moduleKey: string,
  enabled: boolean,
): Promise<ModuleToggleState> {
  try {
    await requirePlatformAdmin();
    await setOrgModuleEnabled(organizationId, moduleKey, enabled);
    revalidatePath(`/admin/organizations/${organizationId}`);
    revalidatePath("/admin/modules");
    return { ok: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return { ok: false, error: message };
  }
}

export type DomainState = { ok: boolean; error: string | null };

const HOSTNAME_RE =
  /^(?=.{1,253}\.?$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export async function addOrgDomainAction(
  organizationId: string,
  _prev: DomainState,
  formData: FormData,
): Promise<DomainState> {
  try {
    await requirePlatformAdmin();

    const raw = String(formData.get("domain") ?? "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    const kind = String(formData.get("kind") ?? "");

    if (kind !== "subdomain" && kind !== "custom") {
      return { ok: false, error: "Choose a domain kind." };
    }
    if (!raw) return { ok: false, error: "Enter a domain." };

    // Subdomain kind: accept a bare slug ("krave") and expand it, or a full
    // <slug>.vinipos.co host. Custom kind: must be a full hostname.
    let domain = raw;
    if (kind === "subdomain") {
      if (SLUG_RE.test(raw)) {
        domain = `${raw}.vinipos.co`;
      } else if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vinipos\.co$/i.test(raw)) {
        return {
          ok: false,
          error: "Subdomain must be a slug like krave, or krave.vinipos.co.",
        };
      }
    }

    if (!HOSTNAME_RE.test(domain)) {
      return { ok: false, error: `"${domain}" is not a valid hostname.` };
    }

    await addOrgDomain(organizationId, domain, kind);
    revalidatePath(`/admin/organizations/${organizationId}`);
    return { ok: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return { ok: false, error: message };
  }
}

export async function removeOrgDomainAction(
  organizationId: string,
  domainId: string,
): Promise<DomainState> {
  try {
    await requirePlatformAdmin();
    await removeOrgDomain(domainId);
    revalidatePath(`/admin/organizations/${organizationId}`);
    return { ok: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return { ok: false, error: message };
  }
}

export async function markDomainVerifiedAction(
  organizationId: string,
  domainId: string,
): Promise<DomainState> {
  try {
    await requirePlatformAdmin();
    // Manual verification for now. Later phase: verify DNS via the Vercel
    // Domains API — POST /v10/projects/{id}/domains (and the verify endpoint)
    // goes here, then persist verified_at on success.
    await markOrgDomainVerified(domainId);
    revalidatePath(`/admin/organizations/${organizationId}`);
    return { ok: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return { ok: false, error: message };
  }
}
