import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireAdmin } from "@/lib/auth/roles";
import { getAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { sendInvitationEmail, isEmailConfigured } from "@/lib/email/mailer";

export const runtime = "nodejs";

/**
 * Build the invitation link against the ACTUAL deployment origin the admin is on
 * (prod domain in production, localhost in local dev), so a production invite can
 * never point at localhost. We intentionally do not read NEXT_PUBLIC_SITE_URL
 * here to avoid a stale/mis-set value leaking a localhost link into production.
 */
function inviteUrlFor(request, token) {
  const origin = new URL(request.url).origin;
  return `${origin}/invite/accept?token=${token}`;
}

// Invitation lifetime policy (server-authoritative; the UI only suggests a value).
const DEFAULT_DAYS = 2; // 48 hours
const MAX_DAYS = 30; // guard against excessively long-lived tokens

/** Clamp a client-supplied expiry (days) to the allowed range; default when invalid. */
function normalizeDays(input) {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.max(1, Math.floor(n)));
}

/** GET /api/admin/invitations → list all invitations (admin only). */
export async function GET() {
  if (!isAdminConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const svc = getAdminClient();
  const { data, error } = await svc
    .from("invitations")
    .select("id, email, created_at, expires_at, accepted_at, revoked_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: "query_failed" }, { status: 500 });
  return NextResponse.json({ invitations: data || [] });
}

/** POST /api/admin/invitations { email, days? } → mint an invite (admin only). */
export async function POST(request) {
  if (!isAdminConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const days = normalizeDays(body?.days);
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const svc = getAdminClient();
  const nowIso = new Date().toISOString();

  // Prevent multiple active (unaccepted, unrevoked, unexpired) invites for the
  // same normalized email — the admin should revoke/delete or resend the existing
  // one instead of minting duplicates.
  const { data: active } = await svc
    .from("invitations")
    .select("id, expires_at")
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .limit(1)
    .maybeSingle();
  if (active) {
    return NextResponse.json(
      { error: "An active invitation already exists for this email. Revoke or delete it, or use Resend, before creating another." },
      { status: 409 }
    );
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

  const { error } = await svc.from("invitations").insert({
    email,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_by: admin.id,
  });
  if (error) return NextResponse.json({ error: "Could not create the invitation." }, { status: 500 });

  const inviteUrl = inviteUrlFor(request, token);

  // Best-effort auto-send. The link is returned either way so the admin can
  // always copy/share it; we report the real send status (never a false success).
  const emailResult = await sendInvitationEmail({ to: email, inviteUrl, expiresAt });

  return NextResponse.json({
    ok: true,
    email,
    inviteUrl,
    expiresAt,
    emailConfigured: isEmailConfigured(),
    emailSent: emailResult.sent === true,
  });
}

/**
 * DELETE /api/admin/invitations { id } → remove a single invitation RECORD only
 * (admin only). This is invitation-history cleanup and is deliberately decoupled
 * from the user lifecycle:
 *  - It touches ONLY the `invitations` table. It never deletes or disables a
 *    Supabase Auth user, profile, project, or Storage file. (Account deletion is
 *    a separate, explicitly-confirmed flow at DELETE /api/admin/users.)
 *  - Deleting a PENDING invite invalidates its token immediately (the row is
 *    gone, so acceptance/validation find nothing).
 *  - Deleting an ACCEPTED invite leaves the activated user fully intact and able
 *    to keep signing in.
 */
export async function DELETE(request) {
  if (!isAdminConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing invitation id." }, { status: 400 });

  const svc = getAdminClient();
  const { data, error } = await svc
    .from("invitations")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not delete the invitation." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  return NextResponse.json({ ok: true, deleted: true });
}
