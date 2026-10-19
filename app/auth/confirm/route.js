import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Email OTP / token-hash verification endpoint, used when Supabase email
 * templates are configured to link to `…/auth/confirm?token_hash=…&type=…`
 * (the alternative to the `?code=` PKCE flow handled by /auth/callback). Covers
 * signup confirmation, magic link, email change, and password recovery.
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=cloud`);
  }
  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=confirm`);
}

function safeNext(next) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
