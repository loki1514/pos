"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { saveWorkflow, setWorkflowActive } from "@/lib/tenant";
import {
  parseDefinition,
  slugIsValid,
  toTenantDefinition,
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
 * an existing template (mode=edit, keyed by the workflow row id). The real
 * data layer (lib/tenant.ts saveWorkflow) never mutates an existing row —
 * with an id it inserts latest+1 for that key — and new rows start active
 * (org_workflows.is_active defaults to true). The version history is the
 * audit trail.
 */
export async function saveWorkflowAction(
  _prev: SaveWorkflowState,
  formData: FormData,
): Promise<SaveWorkflowState> {
  try {
    await requirePlatformAdmin();

    const mode = String(formData.get("mode") ?? "");
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const key = String(formData.get("key") ?? "").trim();
    const module = String(formData.get("module") ?? "") as WorkflowModule;
    const rawDefinition = String(formData.get("definition") ?? "");

    if (mode !== "create" && mode !== "edit") {
      return { ...INITIAL, error: "Unknown save mode." };
    }
    if (mode === "edit" && !id) {
      return { ...INITIAL, error: "Missing workflow id — reopen the editor." };
    }
    if (!name) return { ...INITIAL, error: "Name is required." };
    if (!slugIsValid(key)) {
      return {
        ...INITIAL,
        error: "Key must be a slug: lowercase letters, digits and underscores, starting with a letter.",
      };
    }
    // Known registry keys preferred; a legacy value already stored on the
    // row is still accepted so old templates remain editable.
    if (
      !WORKFLOW_MODULES.includes(module) &&
      !/^[a-z][a-z0-9_]{1,63}$/.test(module)
    ) {
      return { ...INITIAL, error: "Choose a module." };
    }

    const { definition, error: defError } = parseDefinition(rawDefinition);
    if (defError || !definition) {
      return { ...INITIAL, error: defError ?? "Definition is invalid." };
    }

    // Scope: empty/"platform" → a template every org inherits (organization_id
    // NULL). A uuid → a workflow owned by that one organization.
    const scope = String(formData.get("organizationId") ?? "").trim();
    const organizationId = scope && scope !== "platform" ? scope : null;

    const saved = await saveWorkflow({
      // With an id, saveWorkflow bumps that key's latest version and ignores
      // key/organizationId — the key stays immutable, as the editor promises.
      id: mode === "edit" ? id : undefined,
      organizationId,
      key,
      name,
      module,
      definition: toTenantDefinition(definition),
    });

    revalidatePath("/admin/workflows");
    return { ok: true, error: null, savedKey: saved.key };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return {
      ...INITIAL,
      error: message.replace(/^saveWorkflow:\s*/, ""),
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
