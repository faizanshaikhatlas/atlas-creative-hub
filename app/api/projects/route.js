import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getSessionProfile, isActiveMember } from "@/lib/auth/roles";
import { validateProjectPayload } from "@/lib/validation/project";

export const runtime = "nodejs";

/**
 * Personal-design collection API. Identity is derived from the authenticated
 * session (never the client); Postgres RLS (owner = auth.uid() AND
 * is_active_member()) is the final authority, and we also gate approval here so
 * the UI can distinguish 401 (sign in) from 403 (awaiting approval).
 */

async function requireOwner() {
  if (!isSupabaseConfigured()) return { error: NextResponse.json({ error: "not_configured" }, { status: 503 }) };
  const profile = await getSessionProfile();
  if (!profile) return { error: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) };
  if (!isActiveMember(profile)) return { error: NextResponse.json({ error: "not_approved", status: profile.status }, { status: 403 }) };
  const supabase = await createSupabaseServerClient();
  return { userId: profile.id, supabase };
}

/** GET /api/projects → the caller's own projects (metadata only, for the dashboard). */
export async function GET() {
  const ctx = await requireOwner();
  if (ctx.error) return ctx.error;
  const { data, error } = await ctx.supabase
    .from("projects")
    .select("id, name, type, width, height, active_page_id, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "query_failed" }, { status: 500 });
  return NextResponse.json({ projects: data || [] });
}

/** POST /api/projects { name, type, width, height, activePageId, pages[] } → create. */
export async function POST(request) {
  const ctx = await requireOwner();
  if (ctx.error) return ctx.error;
  const { userId, supabase } = ctx;

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }

  // Allow a client-provided id (keeps the editor's local id stable), else let PG default it.
  const id = typeof body?.id === "string" && body.id ? body.id : undefined;
  const v = validateProjectPayload(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 422 });

  const now = new Date().toISOString();
  const projectRow = {
    ...(id ? { id } : {}),
    owner: userId,
    name: v.value.name,
    type: v.value.type,
    width: v.value.width,
    height: v.value.height,
    active_page_id: v.value.activePageId,
    updated_at: now,
  };
  const { data: created, error: pErr } = await supabase
    .from("projects").insert(projectRow).select("id, updated_at").single();
  if (pErr) return NextResponse.json({ error: "create_failed" }, { status: 500 });

  const pageRows = v.value.pages.map((p, i) => ({
    id: p.id, project_id: created.id, owner: userId,
    position: i, name: p.name, background: p.background,
    width: p.width, height: p.height, doc: p.doc,
  }));
  const { error: pgErr } = await supabase.from("pages").insert(pageRows);
  if (pgErr) {
    // Roll back the just-created project so we never report a half-made design.
    await supabase.from("projects").delete().eq("id", created.id);
    return NextResponse.json({ error: "create_pages_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: created.id, updatedAt: created.updated_at }, { status: 201 });
}
