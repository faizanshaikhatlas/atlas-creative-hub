import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireAdmin } from "@/lib/auth/roles";
import { getAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

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
  const days = Math.min(90, Math.max(1, Number(body?.days) || 7));
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

  const svc = getAdminClient();
  const { error } = await svc.from("invitations").insert({
    email,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_by: admin.id,
  });
  if (error) return NextResponse.json({ error: "Could not create the invitation." }, { status: 500 });

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const inviteUrl = `${site.replace(/\/$/, "")}/invite/accept?token=${token}`;
  return NextResponse.json({ ok: true, email, inviteUrl, expiresAt });
}
