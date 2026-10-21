import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Phase 4 route protection.
 *
 * Always protected (require a signed-in user): /admin, /account. The admin ROLE
 * check itself happens server-side in the route/page (requireAdmin / the /admin
 * server gate); middleware only ensures there is a session and sends anonymous
 * visitors to /login?next=… (nicer than rendering then bouncing).
 *
 * The dashboard (/) and editor (/editor/*) stay PUBLIC by default to preserve
 * the existing local-first / guest experience (product decision D; guest mode
 * is formalized in Phase 6). Setting NEXT_PUBLIC_REQUIRE_AUTH=true opts into a
 * full login wall for those too — a config switch, not a code change.
 *
 * API route handlers enforce their own authorization (requireAdmin → 403, token
 * checks, RLS), so middleware does not gate /api/* here (it must not turn an API
 * call into an HTML redirect).
 *
 * Cloud data access is enforced by Postgres RLS (owner = auth.uid()) regardless
 * of any UI, so guessing IDs or calling the Data API directly returns nothing.
 */
const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";

export async function middleware(request) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const needsAuth =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname === "/editor" ||
    pathname.startsWith("/editor/") ||
    (REQUIRE_AUTH && pathname === "/");

  if (needsAuth && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + (search || ""));
    const redirect = NextResponse.redirect(loginUrl);
    // Preserve refreshed session cookies across the redirect.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
