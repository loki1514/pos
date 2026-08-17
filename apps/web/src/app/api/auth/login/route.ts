import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * One credential store: Supabase Auth. The Vini super admin used to be a
 * separate env-var/signed-cookie account (see git history) — that meant a
 * second set of secrets (MASTER_ADMIN_EMAIL/PASSWORD, AUTH_SECRET) to keep in
 * sync across every deployment, and a real outage when a hosting target
 * missed one. Now super admins are ordinary Supabase Auth users with a row in
 * `platform_admins` (migration 0001); org admins have a row in `org_users`
 * (migration 0004). Same sign-in call, role decided after the fact.
 */
export async function POST(request: Request) {
  let email = "";
  let password = "";

  try {
    const body = (await request.json()) as { email?: string; password?: string };
    email = body.email ?? "";
    password = body.password ?? "";
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  try {
    const supabase = await supabaseServer();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Blunt the brute-force edge without a rate-limit store.
      await new Promise((r) => setTimeout(r, 550));
      return NextResponse.json(
        { error: "Those credentials don't match a Vini account." },
        { status: 401 },
      );
    }

    const { data: isPlatformAdmin, error: rpcError } =
      await supabase.rpc("is_platform_admin");
    if (rpcError) throw rpcError;

    return NextResponse.json({
      ok: true,
      role: isPlatformAdmin ? "super_admin" : "org_admin",
    });
  } catch (err) {
    // Configuration problems (missing env vars) land here. Say so plainly —
    // a bare 500 is indistinguishable from a bug in the login flow itself.
    console.error("login: sign-in failed", err);
    return NextResponse.json(
      {
        error:
          "Sign-in service is misconfigured on this deployment. Check the server environment variables.",
      },
      { status: 500 },
    );
  }
}
