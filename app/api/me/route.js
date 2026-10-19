import { NextResponse } from "next/server";
import { getSessionProfile, isActiveMember } from "@/lib/auth/roles";

export const runtime = "nodejs";

/**
 * GET /api/me → the caller's own identity + role, resolved server-side from
 * profiles. Used by the header to decide whether to show the Admin link. The
 * role here is authoritative (server-read); client code must not trust a role
 * it sets itself.
 */
export async function GET() {
  const p = await getSessionProfile();
  if (!p) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated: true,
    email: p.email,
    role: p.role,
    status: p.status,
    provider: p.provider,
    disabled: p.disabled,
    // Authoritative, server-resolved gate for approval-sensitive UI.
    active: isActiveMember(p),
  });
}
