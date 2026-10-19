import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client for the App Router (Server Components, Route
 * Handlers, Server Actions). Reads/writes the SAME auth cookies the browser
 * client and middleware use, so the session is verifiable on the server.
 *
 * Always authenticate server-side with `getServerUser()` /
 * `supabase.auth.getUser()` (which re-validates the JWT with Supabase Auth),
 * never by trusting a value sent from the browser. Only the public URL + anon
 * key are used here; the service-role key is never referenced in app code.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(url && anonKey);
}

/**
 * Create a request-scoped server client. Must be awaited because `cookies()` is
 * async in Next 16. In a Server Component the cookie store is read-only, so
 * `setAll` is wrapped in try/catch — the middleware is what actually refreshes
 * and persists rotated session cookies on each request.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component render (read-only cookies). Safe to
          // ignore — session refresh happens in middleware.
        }
      },
    },
  });
}

/**
 * Server-side current user, re-validated against Supabase Auth, or null.
 * Returns null (never throws) when cloud is not configured so local-first
 * rendering is unaffected.
 */
export async function getServerUser() {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}
