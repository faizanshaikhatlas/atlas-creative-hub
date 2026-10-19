import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { getAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /api/admin/invitations/revoke { id } → revoke a pending invitation
 * (admin only). Only unaccepted invites can be revoked; a revoked invite can
 * never be accepted (the accept endpoint rejects `revoked_at is not null`).
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
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing invitation id." }, { status: 400 });

  const svc = getAdminClient();
  const { data, error } = await svc
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Could not revoke." }, { status: 500 });
  if (!data) {
    return NextResponse.json(
      { error: "Invitation not found, already used, or already revoked." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
