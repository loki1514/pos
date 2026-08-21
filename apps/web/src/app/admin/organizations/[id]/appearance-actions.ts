"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fontById, hexToHsl, type OrgTheme } from "@/lib/theme";

export type AppearanceState = { ok: boolean; error: string | null };

export async function saveAppearanceAction(
  organizationId: string,
  _prev: AppearanceState,
  formData: FormData,
): Promise<AppearanceState> {
  try {
    await requirePlatformAdmin();

    const accent = String(formData.get("accent") ?? "").trim();
    const font = String(formData.get("font") ?? "").trim();
    const weatherHint = String(formData.get("weatherHint") ?? "") === "on";
    const useDefault = String(formData.get("useDefault") ?? "") === "true";

    if (useDefault) {
      const { error } = await supabaseAdmin
        .from("organizations")
        .update({ theme: {} })
        .eq("id", organizationId);
      if (error) throw new Error(error.message);
      revalidatePath(`/admin/organizations/${organizationId}`);
      return { ok: true, error: null };
    }

    // Validate here as well as in the DB constraint — a clear message beats a
    // Postgres check-violation string.
    if (accent && !hexToHsl(accent)) {
      return { ok: false, error: "Accent must be a hex colour like #b4ee2a." };
    }
    if (font && !fontById(font).id) {
      return { ok: false, error: "That font isn't in the catalog." };
    }

    const theme: OrgTheme = {};
    if (accent) theme.accent = accent.toLowerCase();
    if (font) theme.font = font;
    if (weatherHint) theme.weatherHint = true;

    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ theme })
      .eq("id", organizationId);

    if (error) throw new Error(error.message);

    revalidatePath(`/admin/organizations/${organizationId}`);
    return { ok: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return { ok: false, error: message };
  }
}
