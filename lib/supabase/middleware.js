import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/**
 * Refresh the Supabase auth session on every matched request and return both the
 * response (carrying any rotated cookies) and the current user, so middleware.js
 * can make routing decisions. When cloud is not configured it is a pass-through
 * no-op with user=null, preserving the local-first app.
 *
 * @returns {Promise<{ response: NextResponse, user: object|null }>}
 */
export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { response, user: null };

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: no logic between creating the client and getUser() — this call
  // refreshes/validates the token and triggers setAll() above when it rotates.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
