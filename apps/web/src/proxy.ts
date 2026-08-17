import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Edge-safe Supabase client for proxy.ts. @supabase/ssr's middleware pattern:
 * reads cookies off the incoming request, writes any refreshed session onto
 * the outgoing response so the browser stays in sync.
 */
function supabaseEdge(request: NextRequest, response: NextResponse) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
}

/**
 * Role is resolved here — not split between proxy and each layout — so
 * there's exactly one place that decides "signed in as what", and no risk of
 * proxy and a layout disagreeing and bouncing a user back and forth forever
 * (this app has hit that bug once already: an org admin sent to /admin,
 * blocked, sent to /login, which sent them back to /admin — infinite loop).
 */
async function resolveRole(
  request: NextRequest,
  response: NextResponse,
): Promise<"super_admin" | "org_admin" | null> {
  const supabase = supabaseEdge(request, response);
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
  return isPlatformAdmin ? "super_admin" : "org_admin";
}

const HOME: Record<"super_admin" | "org_admin", string> = {
  super_admin: "/admin",
  org_admin: "/org",
};

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const response = NextResponse.next();
  const role = await resolveRole(request, response);

  if (pathname.startsWith("/admin") && role !== "super_admin") {
    // Signed in as something else (org admin) → their own home, not /login,
    // which would just bounce them straight back here.
    if (role) return NextResponse.redirect(new URL(HOME[role], request.url));

    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && role) {
    return NextResponse.redirect(new URL(HOME[role], request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
