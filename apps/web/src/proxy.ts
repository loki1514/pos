import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";

/** Presence of a Supabase auth cookie — cheap check, no network call. */
function hasSupabaseSession(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
}

export default async function proxy(request: NextRequest) {
  const superAdmin = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/admin") && !superAdmin) {
    // An org admin is signed in but not permitted here — send them to their
    // own dashboard. Sending them to /login would loop, since they are
    // already authenticated.
    if (hasSupabaseSession(request)) {
      return NextResponse.redirect(new URL("/org", request.url));
    }

    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && superAdmin) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
