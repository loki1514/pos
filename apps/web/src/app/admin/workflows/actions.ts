"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { saveWorkflowVersion, setWorkflowActive } from "@/lib/tenant";
import {
  parseDefinition,
  slugIsValid,
  WORKFLOW_MODULES,
  type WorkflowModule,
} from "@/components/admin/workflows/definition";

export type SaveWorkflowState = {
  ok: boolean;
  error: string | null;
  /** Set after a successful save so the editor can close itself. */
  savedKey: string | null;
};

const INITIAL: SaveWorkflowState = { ok: false, error: null, savedKey: null };

/**
 * Creates a template (mode=create, version 1) or saves the next version of
 * an existing template (mode=edit). Never mutates an existing row — the
 * version history is the audit trail.
 */
export async function saveWorkflowAction(
  _prev: SaveWorkflowState,
  formData: FormData,
): Promise<SaveWorkflowState> {
  try {
    await requirePlatformAdmin();

    const mode = String(formData.get("mode") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const key = String(formData.get("key") ?? "").trim();
    const module = String(formData.get("module") ?? "") as WorkflowModule;
    const rawDefinition = String(formData.get("definition") ?? "");

    if (mode !== "create" && mode !== "edit") {
      return { ...INITIAL, error: "Unknown save mode." };
    }
    if (!name) return { ...INITIAL, error: "Name is required." };
    if (!slugIsValid(key)) {
      return {
        ...INITIAL,
        error: "Key must be a slug: lowercase letters, digits and underscores, starting with a letter.",
      };
    }
    if (!WORKFLOW_MODULES.includes(module)) {
      return { ...INITIAL, error: "Choose a module." };
    }

    const { definition, error: defError } = parseDefinition(rawDefinition);
    if (defError || !definition) {
      return { ...INITIAL, error: defError ?? "Definition is invalid." };
    }

    await saveWorkflowVersion({
      organizationId: null, // platform template
      key,
      name,
      module,
      definition,
    });

    revalidatePath("/admin/workflows");
    return { ok: true, error: null, savedKey: key };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return {
      ...INITIAL,
      error: message.replace(/^saveWorkflowVersion:\s*/, ""),
    };
  }
}

export type ToggleState = { ok: boolean; error: string | null };

export async function setWorkflowActiveAction(
  id: string,
  isActive: boolean,
): Promise<ToggleState> {
  try {
    await requirePlatformAdmin();
    await setWorkflowActive(id, isActive);
    revalidatePath("/admin/workflows");
    return { ok: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return { ok: false, error: message.replace(/^setWorkflowActive:\s*/, "") };
  }
}
