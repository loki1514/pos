"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** Roles allowed to manage the menu (spec: org_admin, manager, biller). */
const MENU_MANAGER_ROLES = ["org_admin", "manager", "biller"] as const;

export type MenuItemInput = {
  organizationId: string;
  id?: string;
  name: string;
  sku: string | null;
  categoryId: string | null;
  /** Inline category create — used when categoryId is null and this is set. */
  newCategoryName?: string | null;
  price: number;
  sortOrder: number;
  isAvailable: boolean;
  /**
   * Image handling:
   * - undefined → keep existing image_url
   * - null → remove image
   * - string → new public URL (client already uploaded to `item-images`)
   */
  imageUrl?: string | null;
};

export type ActionResult = { ok: boolean; error: string | null };

const OK: ActionResult = { ok: true, error: null };

function fail(error: string): ActionResult {
  return { ok: false, error };
}

/**
 * Throws unless the signed-in user is an active org_admin / manager / biller
 * of `organizationId`. Every mutating menu action calls this before touching
 * supabaseAdmin, since the admin client bypasses RLS — mirroring
 * `requireOrgAdmin` in src/lib/org.ts.
 */
async function requireMenuManager(organizationId: string): Promise<string> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data } = await supabaseAdmin
    .from("org_users")
    .select("id, roles!inner(slug)")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("roles.slug", [...MENU_MANAGER_ROLES])
    .maybeSingle();

  if (!data) {
    throw new Error("You don't have permission to manage the menu.");
  }
  return user.id;
}

async function ensureCategory(
  organizationId: string,
  categoryId: string | null,
  newCategoryName?: string | null,
): Promise<string | null> {
  const name = newCategoryName?.trim();
  if (categoryId || !name) return categoryId;

  const { data: maxRow } = await supabaseAdmin
    .from("menu_categories")
    .select("sort_order")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabaseAdmin
    .from("menu_categories")
    .insert({
      organization_id: organizationId,
      name,
      sort_order: (maxRow?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error) throw new Error(`createCategory: ${error.message}`);
  return data.id as string;
}

export async function saveMenuItemAction(input: MenuItemInput): Promise<ActionResult> {
  try {
    await requireMenuManager(input.organizationId);

    const name = input.name.trim();
    if (!name) return fail("Item name is required.");
    if (!Number.isFinite(input.price) || input.price < 0) {
      return fail("Price must be a non-negative number.");
    }
    const price = Math.round(input.price * 100) / 100;

    const categoryId = await ensureCategory(
      input.organizationId,
      input.categoryId,
      input.newCategoryName,
    );

    const row = {
      organization_id: input.organizationId,
      category_id: categoryId,
      name,
      sku: input.sku?.trim() || null,
      price,
      sort_order: Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder) : 0,
      is_available: input.isAvailable,
      ...(input.imageUrl !== undefined ? { image_url: input.imageUrl } : {}),
    };

    if (input.id) {
      const { error } = await supabaseAdmin
        .from("menu_items")
        .update(row)
        .eq("id", input.id)
        .eq("organization_id", input.organizationId);
      if (error) return fail(`Update failed: ${error.message}`);
    } else {
      const { error } = await supabaseAdmin.from("menu_items").insert(row);
      if (error) return fail(`Create failed: ${error.message}`);
    }

    revalidatePath("/org/menu-items");
    revalidatePath("/org/pos");
    return OK;
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}

export async function setAvailabilityAction(
  organizationId: string,
  itemId: string,
  isAvailable: boolean,
): Promise<ActionResult> {
  try {
    await requireMenuManager(organizationId);
    const { error } = await supabaseAdmin
      .from("menu_items")
      .update({ is_available: isAvailable })
      .eq("id", itemId)
      .eq("organization_id", organizationId);
    if (error) return fail(`Update failed: ${error.message}`);
    revalidatePath("/org/menu-items");
    revalidatePath("/org/pos");
    return OK;
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}

/**
 * Hard delete. The UI steers staff toward the availability toggle instead;
 * this exists for genuine cleanup and carries a warning in the dialog.
 */
export async function deleteMenuItemAction(
  organizationId: string,
  itemId: string,
): Promise<ActionResult> {
  try {
    await requireMenuManager(organizationId);
    const { error } = await supabaseAdmin
      .from("menu_items")
      .delete()
      .eq("id", itemId)
      .eq("organization_id", organizationId);
    if (error) return fail(`Delete failed: ${error.message}`);
    revalidatePath("/org/menu-items");
    revalidatePath("/org/pos");
    return OK;
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}
