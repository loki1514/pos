"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { setRoleModuleVisible } from "@/lib/tenant";

export type RoleAccessState = {
  ok: boolean;
  error: string | null;
  /** Number of cells actually written, for the confirmation toast. */
  applied: number;
};

export type PendingChange = {
  roleId: string;
  moduleKey: string;
  visible: boolean;
};

/**
 * Constant-time-ish comparison. Not defending against a remote attacker here
 * (this is behind platform-admin auth already) — it's a second lock so a
 * logged-in admin can't casually rewrite permissions without deliberately
 * unlocking first.
 */
function passcodeMatches(input: string): boolean {
  const expected = process.env.ADMIN_BUILDER_PASSCODE ?? "";
  if (!expected) return false;
  if (input.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Applies a whole batch of role × module changes at once.
 *
 * Batched deliberately: the user reviews exactly what is about to change,
 * confirms, and enters the builder passcode — permissions never move on a
 * stray click.
 */
export async function saveRoleAccessAction(
  _prev: RoleAccessState,
  formData: FormData,
): Promise<RoleAccessState> {
  try {
    await requirePlatformAdmin();

    if (!process.env.ADMIN_BUILDER_PASSCODE) {
      return {
        ok: false,
        applied: 0,
        error:
          "Builder passcode is not configured on this deployment. Set ADMIN_BUILDER_PASSCODE in the environment before permissions can be changed.",
      };
    }

    const passcode = String(formData.get("passcode") ?? "");
    if (!passcodeMatches(passcode)) {
      await new Promise((r) => setTimeout(r, 400));
      return { ok: false, applied: 0, error: "That passcode is not correct." };
    }

    const scope = String(formData.get("organizationId") ?? "").trim();
    const organizationId = scope && scope !== "platform" ? scope : null;

    let changes: PendingChange[];
    try {
      changes = JSON.parse(String(formData.get("changes") ?? "[]"));
    } catch {
      return { ok: false, applied: 0, error: "Could not read the changes." };
    }

    if (!Array.isArray(changes) || changes.length === 0) {
      return { ok: false, applied: 0, error: "Nothing to save." };
    }

    for (const change of changes) {
      if (!change.roleId || !change.moduleKey) {
        return { ok: false, applied: 0, error: "A change was malformed — nothing was saved." };
      }
      await setRoleModuleVisible(
        organizationId,
        change.roleId,
        change.moduleKey,
        Boolean(change.visible),
      );
    }

    revalidatePath("/admin/roles");
    return { ok: true, error: null, applied: changes.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return {
      ok: false,
      applied: 0,
      error: message.replace(/^setRoleModuleVisible:\s*/, ""),
    };
  }
}
