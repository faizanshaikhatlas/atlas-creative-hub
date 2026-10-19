import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Server-side sign-out. Clears the session cookies and redirects to /login.
 * POST-only to avoid sign-out via a cross-site GET / link prefetch.
 */
export async function POST(request) {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
