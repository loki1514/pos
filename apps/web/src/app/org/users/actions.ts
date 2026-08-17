"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireOrgAdmin } from "@/lib/org";
import { createInvite } from "@/lib/invites";
import { supabaseServer } from "@/lib/supabase-server";
import type { InviteActionState } from "@/components/shared/InviteCard";

/**
 * Org-admin equivalent of createInviteAction (admin/organizations/actions.ts).
 * Same underlying createInvite() call, but authorized by the caller's own
 * Supabase session + requireOrgAdmin — not the super-admin env cookie — so an
 * org admin can invite their own staff without going through Vini.
 */
export async function createOrgInviteAction(
  organizationId: string,
  roleId: string,
  _prev: InviteActionState,
): Promise<InviteActionState> {
  try {
    if (!roleId) return { ok: false, error: "Choose a role first.", url: null };

    await requireOrgAdmin(organizationId);

    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { token } = await createInvite(organizationId, roleId, user!.email!);

    const host = (await headers()).get("host") ?? "";
    const proto = process.env.NODE_ENV === "production" ? "https" : "http";
    const url = `${proto}://${host}/invite/${token}`;

    revalidatePath("/org/users");
    return { ok: true, error: null, url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return { ok: false, error: message.replace(/^createInvite:\s*/, ""), url: null };
  }
}
