import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * OAuth / PKCE code-exchange callback. Supabase email links (signup confirmation,
 * magic link, password recovery) and the password-reset redirect land here with
 * a `?code=`. We exchange it for a session (cookies set server-side via the
 * server client) and redirect to `next` (defaults to home; recovery uses
 * `next=/update-password`).
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=cloud`);
  }
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}

// Only allow same-origin relative paths to avoid open-redirects.
function safeNext(next) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
