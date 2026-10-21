import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getSessionProfile, isActiveMember } from "@/lib/auth/roles";
import { validateProjectPayload } from "@/lib/validation/project";

export const runtime = "nodejs";

async function requireOwner() {
  if (!isSupabaseConfigured()) return { error: NextResponse.json({ error: "not_configured" }, { status: 503 }) };
  const profile = await getSessionProfile();
  if (!profile) return { error: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) };
  if (!isActiveMember(profile)) return { error: NextResponse.json({ error: "not_approved", status: profile.status }, { status: 403 }) };
  const supabase = await createSupabaseServerClient();
  return { userId: profile.id, supabase };
}

/** GET /api/projects/:id → one project + its pages (owner-scoped by RLS). */
export async function GET(_request, { params }) {
  const ctx = await requireOwner();
  if (ctx.error) return ctx.error;
  const { id } = await params;

  const { data: project, error } = await ctx.supabase
    .from("projects")
    .select("id, name, type, width, height, active_page_id, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "query_failed" }, { status: 500 });
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: pages, error: pgErr } = await ctx.supabase
    .from("pages")
    .select("id, position, name, background, width, height, doc")
    .eq("project_id", id)
    .order("position", { ascending: true });
  if (pgErr) return NextResponse.json({ error: "query_failed" }, { status: 500 });

  return NextResponse.json({ project, pages: pages || [] });
}

/**
 * PUT /api/projects/:id → replace project meta + pages (owner-scoped).
 * Optional `expectedUpdatedAt` guards against clobbering a newer cloud version
 * written by another device (409 conflict instead of silent overwrite). Reports
 * success (and the new updated_at) only after every write confirms.
 */
export async function PUT(request, { params }) {
  const ctx = await requireOwner();
  if (ctx.error) return ctx.error;
  const { userId, supabase } = ctx;
  const { id } = await params;

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }

  // Ownership/existence (RLS scopes this to the caller).
  const { data: existing, error: exErr } = await supabase
    .from("projects").select("id, updated_at").eq("id", id).maybeSingle();
  if (exErr) return NextResponse.json({ error: "query_failed" }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Stale-write guard (optimistic concurrency).
  if (body?.expectedUpdatedAt && existing.updated_at &&
      new Date(existing.updated_at).getTime() > new Date(body.expectedUpdatedAt).getTime()) {
    return NextResponse.json({ error: "conflict", serverUpdatedAt: existing.updated_at }, { status: 409 });
  }

  const v = validateProjectPayload(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 422 });

  const now = new Date().toISOString();
  const { error: upErr } = await supabase.from("projects").update({
    name: v.value.name, type: v.value.type, width: v.value.width, height: v.value.height,
    active_page_id: v.value.activePageId, updated_at: now,
  }).eq("id", id);
  if (upErr) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  const pageRows = v.value.pages.map((p, i) => ({
    id: p.id, project_id: id, owner: userId,
    position: i, name: p.name, background: p.background,
    width: p.width, height: p.height, doc: p.doc,
  }));
  const { error: pgErr } = await supabase.from("pages").upsert(pageRows);
  if (pgErr) return NextResponse.json({ error: "update_pages_failed" }, { status: 500 });

  // Prune pages removed locally (owner-scoped).
  const keep = pageRows.map((r) => r.id);
  let del = supabase.from("pages").delete().eq("project_id", id);
  if (keep.length) del = del.not("id", "in", `(${keep.join(",")})`);
  const { error: delErr } = await del;
  if (delErr) return NextResponse.json({ error: "prune_failed" }, { status: 500 });

  return NextResponse.json({ ok: true, updatedAt: now });
}

/** DELETE /api/projects/:id → delete the project; pages cascade (FK). Idempotent. */
export async function DELETE(_request, { params }) {
  const ctx = await requireOwner();
  if (ctx.error) return ctx.error;
  const { id } = await params;
  const { data, error } = await ctx.supabase
    .from("projects").delete().eq("id", id).select("id");
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, removed: data?.length || 0 });
}
