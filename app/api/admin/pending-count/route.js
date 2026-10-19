import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { getAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/admin/pending-count → { pending: <int> } for the header notification.
 * Admin-only (requireAdmin). Returns ONLY an aggregate count — never any other
 * user's email or data — so it exposes nothing private to non-admins (they get
 * 403) or in the payload itself.
 */
export async function GET() {
  if (!isAdminConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const svc = getAdminClient();
  const { count, error } = await svc
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .eq("disabled", false);

  if (error) return NextResponse.json({ error: "query_failed" }, { status: 500 });
  return NextResponse.json({ pending: count || 0 });
}
