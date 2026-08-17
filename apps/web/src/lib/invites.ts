import "server-only";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** Invite links live 7 days — long enough to forward, short enough to go stale. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type Invite = {
  id: string;
  organization_id: string;
  role_id: string;
  token: string;
  created_by: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_email: string | null;
  created_at: string;
};

export type InviteSummary = Pick<
  Invite,
  "id" | "token" | "expires_at" | "accepted_at" | "accepted_email" | "created_at"
> & { role_name: string; state: "used" | "expired" | "open" };

export async function listInvites(organizationId: string): Promise<InviteSummary[]> {
  const { data, error } = await supabaseAdmin
    .from("org_invites")
    .select("id, token, expires_at, accepted_at, accepted_email, created_at, roles!inner(name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(`listInvites: ${error.message}`);

  const now = Date.now();
  return (data ?? []).map((row) => ({
    id: row.id,
    token: row.token,
    expires_at: row.expires_at,
    accepted_at: row.accepted_at,
    accepted_email: row.accepted_email,
    created_at: row.created_at,
    role_name: (row.roles as unknown as { name: string }).name,
    state:
      row.accepted_at !== null
        ? "used"
        : new Date(row.expires_at).getTime() < now
          ? "expired"
          : "open",
  }));
}

export async function createInvite(
  organizationId: string,
  roleId: string,
  createdBy: string,
): Promise<{ token: string; expires_at: string }> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  const { error } = await supabaseAdmin.from("org_invites").insert({
    organization_id: organizationId,
    role_id: roleId,
    token,
    created_by: createdBy,
    expires_at: expiresAt,
  });

  if (error) throw new Error(`createInvite: ${error.message}`);
  return { token, expires_at: expiresAt };
}

/** Public, safe-to-render view of an invite for the signup page. */
export type InviteDetails = {
  orgName: string;
  roleName: string;
  expired: boolean;
  used: boolean;
};

export async function getInviteDetails(token: string): Promise<InviteDetails | null> {
  const { data, error } = await supabaseAdmin
    .from("org_invites")
    .select("expires_at, accepted_at, organizations!inner(name), roles!inner(name)")
    .eq("token", token)
    .maybeSingle();

  if (error) throw new Error(`getInviteDetails: ${error.message}`);
  if (!data) return null;

  return {
    orgName: (data.organizations as unknown as { name: string }).name,
    roleName: (data.roles as unknown as { name: string }).name,
    expired: new Date(data.expires_at).getTime() < Date.now(),
    used: data.accepted_at !== null,
  };
}

/**
 * Turn an invite into a real account: create the Supabase Auth user, attach
 * them to the organization in the invited role, and burn the link. Single
 * use — the accepted_at write is what makes a replayed link fail.
 */
export async function acceptInvite(
  token: string,
  input: { fullName: string; email: string; password: string },
): Promise<{ orgName: string }> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

  if (!fullName) throw new Error("Your name is required.");
  if (!email) throw new Error("An email is required.");
  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("org_invites")
    .select("id, organization_id, role_id, expires_at, accepted_at, organizations!inner(name)")
    .eq("token", token)
    .maybeSingle();

  if (inviteError) throw new Error(`acceptInvite: ${inviteError.message}`);
  if (!invite) throw new Error("This invite link is not valid.");
  if (invite.accepted_at) throw new Error("This invite link has already been used.");
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    throw new Error("This invite link has expired. Ask for a new one.");
  }

  const { data: authUser, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { organization_id: invite.organization_id },
    });

  if (authError || !authUser.user) {
    const msg = authError?.message ?? "Unknown error";
    if (/already been registered|already exists/i.test(msg)) {
      throw new Error(
        "An account with this email already exists — sign in instead.",
      );
    }
    throw new Error(`Could not create the account: ${msg}`);
  }

  const { error: membershipError } = await supabaseAdmin
    .from("org_users")
    .insert({
      organization_id: invite.organization_id,
      user_id: authUser.user.id,
      role_id: invite.role_id,
      email,
      full_name: fullName,
    });

  if (membershipError) {
    // The auth user exists but is attached to nothing — surface it rather
    // than leaving an orphan for support to untangle.
    throw new Error(
      `Account created but could not be linked to the organization: ${membershipError.message}`,
    );
  }

  const { error: burnError } = await supabaseAdmin
    .from("org_invites")
    .update({ accepted_at: new Date().toISOString(), accepted_email: email })
    .eq("id", invite.id)
    .is("accepted_at", null);

  if (burnError) throw new Error(`acceptInvite: ${burnError.message}`);

  return { orgName: (invite.organizations as unknown as { name: string }).name };
}
