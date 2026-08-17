/**
 * Bootstrap super-admin authentication.
 *
 * Deliberately self-contained: the Vini super admin is the account that exists
 * BEFORE any organization does, so it cannot live in an org-scoped Supabase
 * table. Sessions are signed HMAC-SHA256 cookies verified with Web Crypto, so
 * this module runs unchanged in both the Node and Edge (middleware) runtimes.
 *
 * When Supabase Auth is wired up (Phase 1, after migrations), org users
 * authenticate there and only this bootstrap account stays here.
 */

export const SESSION_COOKIE = "vini_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8h — one shift

export type Session = {
  sub: string;
  role: "super_admin";
  exp: number;
};

function enc(s: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(s) as Uint8Array<ArrayBuffer>;
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short (needs ≥32 chars). Set it in .env.local.",
    );
  }
  return s;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Constant-time string comparison — avoids leaking the password via timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = enc(a);
  const bb = enc(b);
  // Compare lengths in a way that still runs the loop.
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export function verifyCredentials(email: string, password: string): boolean {
  const expectedEmail = process.env.MASTER_ADMIN_EMAIL;
  const expectedPassword = process.env.MASTER_ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword) return false;

  // Evaluate both so a wrong email costs the same time as a wrong password.
  const emailOk = safeEqual(email.trim().toLowerCase(), expectedEmail.toLowerCase());
  const passOk = safeEqual(password, expectedPassword);
  return emailOk && passOk;
}

export async function createSession(sub: string): Promise<string> {
  const payload: Session = {
    sub,
    role: "super_admin",
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = b64url(enc(JSON.stringify(payload)));
  const sig = b64url(await crypto.subtle.sign("HMAC", await key(), enc(body)));
  return `${body}.${sig}`;
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify("HMAC", await key(), unb64url(sig), enc(body));
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const session = JSON.parse(new TextDecoder().decode(unb64url(body))) as Session;
    if (session.exp * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = SESSION_TTL_SECONDS;
