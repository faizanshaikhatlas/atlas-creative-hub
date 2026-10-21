import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireAdmin } from "@/lib/auth/roles";
import { getAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { sendInvitationEmail, isEmailConfigured } from "@/lib/email/mailer";

export const runtime = "nodejs";

/**
 * POST /api/admin/invitations/resend { token } → re-send the invitation email for
 * an EXISTING, still-valid invite (admin only). It reuses the same token the
 * admin already holds from creation (the raw token is never stored server-side,
 * only its hash), so this does NOT mint a new invite and does NOT revoke/replace
 * the current one — avoiding duplicates. The invite is re-validated server-side
 * (unaccepted, unrevoked, unexpired) before sending. The email is always the
 * invite's own bound address.
 */
export async function POST(request) {
  if (!isAdminConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const token = typeof body?.token === "string" ? body.token : "";
  if (token.length < 20) {
    return NextResponse.json({ error: "This invitation link is invalid." }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const svc = getAdminClient();
  const { data: inv } = await svc
    .from("invitations")
    .select("email, expires_at, accepted_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (
    !inv ||
    inv.accepted_at ||
    inv.revoked_at ||
    new Date(inv.expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json(
      { error: "This invitation is invalid, expired, or already used." },
      { status: 400 }
    );
  }

  const inviteUrl = `${new URL(request.url).origin}/invite/accept?token=${token}`;
  const result = await sendInvitationEmail({ to: inv.email, inviteUrl, expiresAt: inv.expires_at });

  return NextResponse.json({
    ok: true,
    email: inv.email,
    expiresAt: inv.expires_at,
    emailConfigured: isEmailConfigured(),
    emailSent: result.sent === true,
  });
}
