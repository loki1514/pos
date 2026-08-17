"use server";

import { acceptInvite } from "@/lib/invites";

export type AcceptState = {
  ok: boolean;
  error: string | null;
  orgName: string | null;
};

export async function acceptInviteAction(
  token: string,
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  try {
    const fullName = String(formData.get("fullName") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const { orgName } = await acceptInvite(token, { fullName, email, password });
    return { ok: true, error: null, orgName };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return { ok: false, error: message, orgName: null };
  }
}
