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

// Private bucket holding every user's design assets, stored under a `${uid}/…`
// prefix (see lib/sync/assets.js and the storage RLS `foldername(name)[1]`).
const DESIGNS_BUCKET = "designs";

/**
 * Recursively enumerate every object path under a storage folder prefix,
 * paginating each level. Supabase `list` is non-recursive and capped per call,
 * so we walk sub-folders and page through them. A folder entry has a null `id`;
 * a file entry has an `id` + metadata.
 */
async function listAllStorageFiles(svc, bucket, prefix) {
  const files = [];
  const PAGE = 100;
  async function walk(folder) {
    let offset = 0;
    for (;;) {
      const { data, error } = await svc.storage
        .from(bucket)
        .list(folder, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      const batch = data || [];
      for (const entry of batch) {
        const path = folder ? `${folder}/${entry.name}` : entry.name;
        if (!entry.id) await walk(path); // sub-folder → recurse
        else files.push(path);
      }
      if (batch.length < PAGE) break;
      offset += PAGE;
    }
  }
  await walk(prefix);
  return files;
}

/**
 * Delete storage objects in batches. Ownership guard: only paths inside the
 * user's OWN `${uid}/` folder are ever removed, so a bug can never touch another
 * user's files or global data. Returns how many were removed and any failures.
 */
async function removeOwnedStorage(svc, bucket, paths, uid) {
  const guard = `${uid}/`;
  const safe = paths.filter((p) => p.startsWith(guard));
  const BATCH = 100;
  let removed = 0;
  const failures = [];
  for (let i = 0; i < safe.length; i += BATCH) {
    const chunk = safe.slice(i, i + BATCH);
    const { data, error } = await svc.storage.from(bucket).remove(chunk);
    if (error) failures.push(error.message);
    else removed += (data || chunk).length;
  }
  return { attempted: safe.length, removed, failures, skipped: paths.length - safe.length };
}

/**
 * DELETE /api/admin/users { id, confirmDeleteData? } → permanently and completely
 * remove a rejected user (admin only):
 *   1. Enumerate + delete the user's OWN Storage files (bucket `designs`, under
 *      the immutable `${uid}/` prefix — never by email, never the whole bucket).
 *   2. Hard-delete the Supabase Auth account, which cascades the profile and all
 *      owner-scoped DB rows (projects → pages, components, assets) via existing
 *      ON DELETE CASCADE FKs. This frees the email to register again immediately.
 * Storage is purged FIRST so that if it fails the account is left intact and the
 * admin can safely retry (reconciliation) rather than stranding orphaned files.
 * Guards: cannot delete your OWN account; cannot delete an admin (demote first,
 * which also preserves last-admin); requires `confirmDeleteData` when the user
 * owns any data. Failure-aware: any step failing returns an error, never success.
 */
export async function DELETE(request) {
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
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const svc = getAdminClient();
  const { data: target, error: tErr } = await svc
    .from("profiles")
    .select("id, email, role")
    .eq("id", id)
    .maybeSingle();
  if (tErr || !target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.role === "admin") {
    return NextResponse.json(
      { error: "Remove the admin role before deleting this account." },
      { status: 400 }
    );
  }

  // Tally everything the deletion will remove so the admin can confirm the loss:
  // the user's own Storage files (UID-prefixed) + owner-scoped DB rows (cascade).
  // Pending users have none of either.
  let storageFiles;
  try {
    storageFiles = await listAllStorageFiles(svc, DESIGNS_BUCKET, id);
  } catch (e) {
    return NextResponse.json(
      { error: "Could not list the user's storage files.", stage: "storage-list", detail: e.message },
      { status: 500 }
    );
  }
  const [projects, components, assets] = await Promise.all([
    svc.from("projects").select("id", { count: "exact", head: true }).eq("owner", id),
    svc.from("components").select("id", { count: "exact", head: true }).eq("owner", id),
    svc.from("assets").select("id", { count: "exact", head: true }).eq("owner", id),
  ]);
  const counts = {
    projects: projects.count || 0,
    components: components.count || 0,
    assets: assets.count || 0,
    storageFiles: storageFiles.length,
  };
  const total = counts.projects + counts.components + counts.assets + counts.storageFiles;

  if (total > 0 && body?.confirmDeleteData !== true) {
    return NextResponse.json(
      { error: "confirm_required", needsDataConfirm: true, counts },
      { status: 409 }
    );
  }

  // 1. Purge the user's own Storage files FIRST. If this fails, stop before
  //    touching the account so the admin can retry without orphaning anything.
  if (storageFiles.length) {
    const { removed, failures } = await removeOwnedStorage(svc, DESIGNS_BUCKET, storageFiles, id);
    if (failures.length) {
      return NextResponse.json(
        {
          error: "Storage cleanup failed — the account was NOT deleted. Please retry.",
          stage: "storage-delete",
          detail: failures[0],
          storageRemoved: removed,
          storageRemaining: storageFiles.length - removed,
        },
        { status: 500 }
      );
    }
  }

  // 2. Hard-delete the Auth user; cascades remove the profile + owner-scoped rows.
  const { error: delErr } = await svc.auth.admin.deleteUser(id);
  if (delErr) {
    // Report the real failure — never show a false success. Storage is already
    // gone; the account row remains, so the admin can retry to finish.
    return NextResponse.json(
      {
        error: "Storage was cleaned, but account deletion failed. Retry to finish.",
        stage: "auth-delete",
        detail: delErr.message,
      },
      { status: 500 }
    );
  }

  // 3. Safety net: ensure the profile row is gone even if the cascade didn't fire.
  await svc.from("profiles").delete().eq("id", id);

  return NextResponse.json({ ok: true, deleted: true, counts, storageDeleted: storageFiles.length });
}
