import { NextResponse } from "next/server";
import { getSessionProfile, isActiveMember } from "@/lib/auth/roles";

export const runtime = "nodejs";
// Approval status must always be fresh — never served from any cache, or a
// "pending" answer from before an admin approved the account could persist.
export const dynamic = "force-dynamic";

/**
 * GET /api/me → the caller's own identity + role, resolved server-side from
 * profiles. Used by the header to decide whether to show the Admin link. The
 * role here is authoritative (server-read); client code must not trust a role
 * it sets itself.
 */
const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function GET() {
  const p = await getSessionProfile();
  if (!p) return NextResponse.json({ authenticated: false }, { headers: NO_STORE });
  return NextResponse.json({
    authenticated: true,
    email: p.email,
    role: p.role,
    status: p.status,
    provider: p.provider,
    disabled: p.disabled,
    // Authoritative, server-resolved gate for approval-sensitive UI.
    active: isActiveMember(p),
  }, { headers: NO_STORE });
}
