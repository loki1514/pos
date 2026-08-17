import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSession,
  verifyCredentials,
} from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * One login endpoint, two credential stores:
 *  1. Vini super admin — env-var credential, signed cookie (src/lib/auth.ts).
 *  2. Everyone else — real Supabase Auth (org admins today; captain/kitchen/
 *     biller land here too once those roles exist).
 *
 * The client never chooses which path to try — it tries the super admin
 * check first (cheap, no network), then falls back to Supabase Auth. The
 * response carries `role` so the login page knows which dashboard to land on.
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

  // 1. Super admin
  if (verifyCredentials(email, password)) {
    try {
      const token = await createSession(email.trim().toLowerCase());
      const response = NextResponse.json({ ok: true, role: "super_admin" });
      response.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_MAX_AGE,
      });
      return response;
    } catch (err) {
      // AUTH_SECRET missing/too short on this deployment.
      console.error("login: session signing failed", err);
      return NextResponse.json(
        {
          error:
            "Sign-in service is misconfigured on this deployment (AUTH_SECRET). Check the server environment variables.",
        },
        { status: 500 },
      );
    }
  }

  // 2. Supabase Auth (org admins, and future org-scoped roles)
  try {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Blunt the brute-force edge without a rate-limit store.
      await new Promise((r) => setTimeout(r, 550));
      return NextResponse.json(
        { error: "Those credentials don't match a Vini account." },
        { status: 401 },
      );
    }

    return NextResponse.json({ ok: true, role: "org_admin" });
  } catch (err) {
    // Configuration problems (missing env vars) land here. Say so plainly —
    // a bare 500 is indistinguishable from a bug in the login flow itself.
    console.error("login: supabase path failed", err);
    return NextResponse.json(
      {
        error:
          "Sign-in service is misconfigured on this deployment. Check the server environment variables.",
      },
      { status: 500 },
    );
  }
}
