"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import {
  createOrganization,
  regenerateAdminPassword,
  type OrgType,
} from "@/lib/organizations";
import { createInvite } from "@/lib/invites";
import { generatePassword } from "@/lib/password";

export type CreateOrgState = {
  ok: boolean;
  error: string | null;
  /** Present only right after a successful create — shown once, never stored client-side. */
  created: { orgName: string; adminEmail: string; adminPassword: string } | null;
};

export async function createOrganizationAction(
  _prev: CreateOrgState,
  formData: FormData,
): Promise<CreateOrgState> {
  try {
    await requirePlatformAdmin();

    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "") as OrgType;
    const legalName = String(formData.get("legalName") ?? "");
    const gstin = String(formData.get("gstin") ?? "");
    const contactEmail = String(formData.get("contactEmail") ?? "");
    const contactPhone = String(formData.get("contactPhone") ?? "");
    const adminEmail = String(formData.get("adminEmail") ?? "").trim();

    if (!name) return { ok: false, error: "Organization name is required.", created: null };
    if (type !== "franchise" && type !== "investor") {
      return { ok: false, error: "Choose an organization type.", created: null };
    }
    if (!adminEmail) {
      return { ok: false, error: "An admin email is required.", created: null };
    }

    const adminPassword = generatePassword();

    const { organization, admin } = await createOrganization({
      name,
      type,
      legalName,
      gstin,
      contactEmail,
      contactPhone,
      adminEmail,
      adminPassword,
    });

    revalidatePath("/admin/organizations");
    revalidatePath("/admin");

    return {
      ok: true,
      error: null,
      created: {
        orgName: organization.name,
        adminEmail: admin.email,
        adminPassword: admin.password,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    const clean = message.replace(/^createOrganization:\s*/, "");
    return { ok: false, error: clean, created: null };
  }
}

export type RegenerateState = {
  ok: boolean;
  error: string | null;
  credentials: { email: string; password: string } | null;
};

export async function regeneratePasswordAction(
  organizationId: string,
  _prev: RegenerateState,
): Promise<RegenerateState> {
  try {
    await requirePlatformAdmin();
    const credentials = await regenerateAdminPassword(organizationId);
    return { ok: true, error: null, credentials };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return { ok: false, error: message.replace(/^regenerateAdminPassword:\s*/, ""), credentials: null };
  }
}

export type InviteState = {
  ok: boolean;
  error: string | null;
  /** Absolute signup URL — shown once in the UI for copying. */
  url: string | null;
};

export async function createInviteAction(
  organizationId: string,
  roleId: string,
  _prev: InviteState,
): Promise<InviteState> {
  try {
    const admin = await requirePlatformAdmin();

    if (!roleId) return { ok: false, error: "Choose a role first.", url: null };

    const { token } = await createInvite(organizationId, roleId, admin.email);

    const host = (await headers()).get("host") ?? "";
    const proto = process.env.NODE_ENV === "production" ? "https" : "http";
    const url = `${proto}://${host}/invite/${token}`;

    revalidatePath(`/admin/organizations/${organizationId}`);
    return { ok: true, error: null, url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return { ok: false, error: message.replace(/^createInvite:\s*/, ""), url: null };
  }
}
