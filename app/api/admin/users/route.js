import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { getAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BAN_DURATION = "876000h"; // ~100 years = effectively disabled

/**
 * On first approval, send the user a secure "set your password & sign in" link.
 * Uses Supabase's recovery email, which is delivered via the project's configured
 * (custom) SMTP — no app-side mailer. Best-effort: never fails the approval.
 * Skipped for OAuth (e.g. Google) users, who have no password to set.
 * @returns {boolean} whether a setup email was dispatched
 */
async function sendApprovalSetupEmail(email, provider, request) {
  if (!email || provider === "google") return false;
  try {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/update-password`,
    });
    return !error;
  } catch {
    return false;
  }
}

/** GET /api/admin/users → list all profiles (admin only). */
export async function GET() {
  if (!isAdminConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const svc = getAdminClient();
  const { data, error } = await svc
    .from("profiles")
    .select("id, email, role, status, provider, disabled, created_at, requested_at, approved_at")
    .order("requested_at", { ascending: false })
    .limit(1000);
  if (error) return NextResponse.json({ error: "query_failed" }, { status: 500 });
  return NextResponse.json({ users: data || [] });
}

/**
 * PATCH /api/admin/users { id, role?, disabled? } → change a user's role and/or
 * disable/enable them (admin only). Guards:
 *  - An admin cannot modify their OWN role or disabled flag (no self-lockout).
 *  - Cannot demote the LAST remaining admin.
 *  - Disabling bans the user in Supabase Auth (immediate on next token refresh);
 *    enabling lifts the ban. The profiles.disabled flag mirrors it for the UI.
 */
export async function PATCH(request) {
  if (!isAdminConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing user id." }, { status: 400 });
  if (id === admin.id) {
    return NextResponse.json({ error: "You cannot change your own role or access." }, { status: 400 });
  }

  const svc = getAdminClient();
  const { data: target, error: tErr } = await svc
    .from("profiles")
    .select("id, email, role, status, provider, disabled")
    .eq("id", id)
    .maybeSingle();
  if (tErr || !target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const updates = {};

  if (body?.role !== undefined) {
    const role = body.role;
    if (role !== "user" && role !== "admin") {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }
    if (target.role === "admin" && role === "user") {
      const { count } = await svc
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count || 0) <= 1) {
        return NextResponse.json({ error: "Cannot remove the last admin." }, { status: 400 });
      }
    }
    updates.role = role;
  }

  if (body?.status !== undefined) {
    const status = body.status;
    if (status !== "approved" && status !== "rejected" && status !== "pending") {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    updates.status = status;
    // Stamp the approval audit trail server-side; clear it when not approved.
    if (status === "approved") {
      updates.approved_at = new Date().toISOString();
      updates.approved_by = admin.id;
    } else {
      updates.approved_at = null;
      updates.approved_by = null;
    }
  }

  if (typeof body?.disabled === "boolean") {
    updates.disabled = body.disabled;
    const { error: banErr } = await svc.auth.admin.updateUserById(id, {
      ban_duration: body.disabled ? BAN_DURATION : "none",
    });
    if (banErr) return NextResponse.json({ error: "Could not update access." }, { status: 500 });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error: uErr } = await svc.from("profiles").update(updates).eq("id", id);
  if (uErr) return NextResponse.json({ error: "Could not update the user." }, { status: 500 });

  // On the pending/rejected → approved transition, email the user a secure
  // password-setup/sign-in link (best-effort; does not block the approval).
  let setupEmailSent = false;
  const approvedNow = updates.status === "approved" && target.status !== "approved";
  if (approvedNow) {
    setupEmailSent = await sendApprovalSetupEmail(target.email, target.provider, request);
  }

  return NextResponse.json({ ok: true, approvedNow, setupEmailSent });
}
