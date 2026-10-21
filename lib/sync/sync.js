"use client";

import { getSupabase, DESIGNS_BUCKET } from "@/lib/supabase/client";
import {
  getDatabase,
  getProject,
  listProjects,
  normalizeProject,
  deleteProject,
  addTombstone,
  setTombstoneCloudDeleted,
  listTombstones,
} from "@/lib/db/projects";
import {
  ownerScopeForUser,
  isOwnedByUser,
  classifySyncStatus,
  collectAssetIds,
  computeDeletableAssetIds,
} from "@/lib/ownership";
import { externalizeAssets, internalizeAssets } from "@/lib/sync/assets";

/**
 * Optional Dexie <-> Supabase sync. Local-first: Dexie is authoritative; the
 * cloud is an additive mirror. Every function is a no-op unless cloud is
 * configured and a userId is supplied, and nothing here ever deletes local data.
 *
 * Idempotency: local UUIDs are reused as cloud primary keys, so every push is an
 * upsert on `id` and can never create a duplicate.
 *
 * Conflicts: detected per project via a stored base `updated_at`; a conflicting
 * push is reported (never silently overwritten) so the UI can prompt the user.
 */

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function syncKey(kind, id) {
  return `${kind}:${id}`;
}

/* ----------------------- ownership + status (pure) ----------------------- */
// These live in the dependency-free lib/ownership module (imported at the top of
// this file) so they're unit-testable against real source; re-exported here for
// existing importers of lib/sync/sync.
export { ownerScopeForUser, isOwnedByUser, classifySyncStatus, collectAssetIds, computeDeletableAssetIds };

async function readSyncState(kind, id) {
  return getDatabase().sync_state.get(syncKey(kind, id));
}

async function writeSyncState(kind, id, patch) {
  const db = getDatabase();
  const key = syncKey(kind, id);
  const existing = (await db.sync_state.get(key)) || { key, kind, remoteId: id };
  await db.sync_state.put({ ...existing, ...patch, key, kind, remoteId: id });
}

/* ------------------------------- push -------------------------------- */

function projectRow(project, userId) {
  return {
    id: project.id,
    owner: userId,
    name: project.name || "Untitled design",
    type: project.type || "custom",
    width: project.width,
    height: project.height,
    active_page_id: project.activePageId ?? null,
  };
}

async function pageRows(project, userId) {
  const pages = Array.isArray(project.pages) ? project.pages : [];
  const rows = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const { doc } = await externalizeAssets(p.json ?? {}, userId);
    rows.push({
      id: p.id,
      project_id: project.id,
      owner: userId,
      position: i,
      name: p.name || `Page ${i + 1}`,
      background: p.background || "#ffffff",
      width: p.width,
      height: p.height,
      doc: doc ?? {},
      // thumbnails are regenerated client-side; not uploaded in this phase
      thumb_asset_id: null,
    });
  }
  return rows;
}

/**
 * Push one project (and its pages + assets) to the cloud.
 * @returns {{status:'ok'|'conflict'|'skipped', serverUpdatedAt?:string}}
 */
export async function syncPushProject(projectOrId, userId, { force = false } = {}) {
  const supabase = getSupabase();
  if (!supabase || !userId) return { status: "skipped" };

  const project =
    typeof projectOrId === "string" ? await getProject(projectOrId) : projectOrId;
  if (!project) return { status: "skipped" };

  // Ownership gate (defense-in-depth with per-account local namespaces): never
  // upload a design that isn't explicitly owned by / claimed to this user. This
  // stops guest, legacy, unclaimed, or another account's designs from ever being
  // pushed into the current user's cloud account.
  if (!isOwnedByUser(project, userId)) {
    return { status: "skipped", reason: project.ownerScope ? "not_owner" : "unclaimed" };
  }

  // Conflict check: did the server copy change since we last synced?
  const state = await readSyncState("project", project.id);
  const { data: serverRow } = await supabase
    .from("projects")
    .select("updated_at")
    .eq("id", project.id)
    .maybeSingle();

  if (serverRow && state?.remoteUpdatedAt && !force) {
    if (new Date(serverRow.updated_at).getTime() > new Date(state.remoteUpdatedAt).getTime()) {
      // Server is ahead of the base we synced from → let the UI resolve it.
      return { status: "conflict", serverUpdatedAt: serverRow.updated_at };
    }
  }

  // Upsert project, then pages, then prune pages deleted locally.
  const { error: pErr } = await supabase.from("projects").upsert(projectRow(project, userId));
  if (pErr) throw pErr;

  const rows = await pageRows(project, userId);
  if (rows.length) {
    const { error: pgErr } = await supabase.from("pages").upsert(rows);
    if (pgErr) throw pgErr;
  }
  const localIds = rows.map((r) => r.id);
  let delQuery = supabase.from("pages").delete().eq("project_id", project.id);
  if (localIds.length) delQuery = delQuery.not("id", "in", `(${localIds.join(",")})`);
  const { error: delErr } = await delQuery;
  if (delErr) throw delErr;

  const { data: fresh } = await supabase
    .from("projects")
    .select("updated_at")
    .eq("id", project.id)
    .single();

  await writeSyncState("project", project.id, {
    remoteUpdatedAt: fresh?.updated_at ?? new Date().toISOString(),
    lastSyncedAt: Date.now(),
    lastError: null, // clear any prior failure on a confirmed success
    lastErrorAt: null,
  });

  return { status: "ok", serverUpdatedAt: fresh?.updated_at };
}

/* ------------------------------- pull -------------------------------- */

/**
 * Pull cloud projects into Dexie. Only writes a project locally when the server
 * copy is newer than what we last pulled; never deletes local-only projects.
 * @returns {{ pulled:number, conflicts:string[] }}
 */
export async function syncPull(userId) {
  const supabase = getSupabase();
  if (!supabase || !userId) return { pulled: 0, conflicts: [] };
  const db = getDatabase();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("owner", userId);
  if (error) throw error;

  // Deletion-aware: tombstoned designs must never be re-created by a pull. If a
  // tombstone's cloud copy is still pending (an earlier cloud delete failed),
  // retry the delete here instead of resurrecting the row.
  const tombstones = await listTombstones();

  let pulled = 0;
  const conflicts = [];

  for (const row of projects || []) {
    const tomb = tombstones[row.id];
    if (tomb) {
      if (!tomb.cloudDeleted) {
        try {
          await deleteCloudProject(row.id, userId);
          await setTombstoneCloudDeleted(row.id, true);
        } catch {
          /* leave pending; a later sync retries. Never re-create the row. */
        }
      }
      continue; // never pull a deleted design back
    }
    const state = await readSyncState("project", row.id);
    const local = await getProject(row.id);

    // If local has unsynced edits AND server moved on, flag a conflict instead
    // of clobbering local work.
    const serverTime = new Date(row.updated_at).getTime();
    const baseTime = state?.remoteUpdatedAt ? new Date(state.remoteUpdatedAt).getTime() : 0;
    const localDirty = local && (local.updatedAt || 0) > (state?.lastSyncedAt || 0);
    if (local && localDirty && serverTime > baseTime) {
      conflicts.push(row.id);
      continue;
    }
    if (local && serverTime <= baseTime) continue; // nothing new

    const { data: pages, error: pgErr } = await supabase
      .from("pages")
      .select("*")
      .eq("project_id", row.id)
      .order("position", { ascending: true });
    if (pgErr) throw pgErr;

    const localPages = [];
    for (const pg of pages || []) {
      const json = await internalizeAssets(pg.doc ?? {}, userId);
      localPages.push({
        id: pg.id,
        name: pg.name,
        json: json ? JSON.stringify(json) : null,
        thumbnail: null, // regenerated locally on open
        background: pg.background || "#ffffff",
        width: pg.width,
        height: pg.height,
      });
    }

    const project = normalizeProject({
      id: row.id,
      name: row.name,
      type: row.type,
      width: row.width,
      height: row.height,
      thumbnail: null,
      activePageId: row.active_page_id,
      pages: localPages.length ? localPages : undefined,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      // A pulled design is, by definition, owned by this user (RLS only returns
      // rows where owner = auth.uid()), so mark it claimed for this scope.
      ownerScope: ownerScopeForUser(userId),
    });

    await db.projects.put(project);
    await writeSyncState("project", row.id, {
      remoteUpdatedAt: row.updated_at,
      lastSyncedAt: Date.now(),
    });
    pulled++;
  }

  return { pulled, conflicts };
}

/* ---------------------------- outbox queue --------------------------- */

/** Enqueue a durable push op (survives reloads). */
export async function enqueuePush(projectId) {
  const db = getDatabase();
  await db.sync_queue.add({
    op: "push",
    projectId,
    status: "pending",
    attempts: 0,
    nextAttemptAt: Date.now(),
    error: null,
  });
}

/**
 * Process the outbox once. Each op is idempotent (upsert on id), so retrying a
 * previously-ambiguous op is safe. Returns a small summary.
 */
export async function processQueue(userId) {
  const supabase = getSupabase();
  if (!supabase || !userId) return { processed: 0, conflicts: [], failed: 0 };
  const db = getDatabase();

  const now = Date.now();
  const due = await db.sync_queue
    .where("status")
    .anyOf("pending", "retry")
    .and((row) => (row.nextAttemptAt || 0) <= now)
    .toArray();

  let processed = 0;
  let failed = 0;
  const conflicts = [];

  for (const op of due) {
    try {
      const result = await syncPushProject(op.projectId, userId);
      if (result.status === "conflict") {
        conflicts.push(op.projectId);
        await db.sync_queue.update(op.seq, { status: "conflict" });
        continue;
      }
      await db.sync_queue.update(op.seq, { status: "done" });
      processed++;
    } catch (err) {
      const attempts = (op.attempts || 0) + 1;
      const backoff = Math.min(RETRY_BASE_MS * 2 ** attempts, RETRY_MAX_MS);
      const jitter = Math.floor(Math.random() * 1000);
      const parked = attempts >= MAX_ATTEMPTS;
      await db.sync_queue.update(op.seq, {
        attempts,
        status: parked ? "parked" : "retry",
        nextAttemptAt: now + backoff + jitter,
        error: String(err?.message || err),
      });
      failed++;
    }
  }

  return { processed, failed, conflicts };
}

/* ------------------------------ deletion ----------------------------- */

/**
 * Best-effort Storage GC for a just-deleted project. Deletes only assets that
 * are (a) owned by this user and (b) no longer referenced by ANY of the user's
 * remaining pages. Owner-scoped on both the assets rows and the Storage objects;
 * never throws (a GC failure must not undo or block the design deletion).
 * @returns {{ deleted:number, skipped:number }}
 */
async function gcOrphanAssets(candidateIds, userId) {
  const supabase = getSupabase();
  if (!supabase || !userId || !candidateIds || candidateIds.size === 0) return { deleted: 0, skipped: 0 };
  // Which candidates are still referenced by the owner's remaining pages?
  const { data: remaining, error } = await supabase.from("pages").select("doc").eq("owner", userId);
  if (error) return { deleted: 0, skipped: candidateIds.size };
  const deletable = computeDeletableAssetIds(candidateIds, (remaining || []).map((r) => r.doc));
  if (!deletable.length) return { deleted: 0, skipped: candidateIds.size };

  // Resolve storage paths (owner-scoped) and remove the objects, then the rows.
  const { data: rows } = await supabase
    .from("assets")
    .select("id, storage_path")
    .in("id", deletable)
    .eq("owner", userId);
  const paths = (rows || []).map((r) => r.storage_path).filter(Boolean);
  if (paths.length) {
    const { error: rmErr } = await supabase.storage.from(DESIGNS_BUCKET).remove(paths);
    if (rmErr) return { deleted: 0, skipped: deletable.length }; // leave rows; retry later
  }
  await supabase.from("assets").delete().in("id", deletable).eq("owner", userId);
  return { deleted: deletable.length, skipped: candidateIds.size - deletable.length };
}

/**
 * Delete the owner's cloud project row. The `pages` rows are removed by the
 * verified `pages_project_fk` ON DELETE CASCADE; associated `assets`/Storage are
 * intentionally left untouched in this phase. Owner-scoped (`.eq("owner", …)`)
 * as defense-in-depth on top of the owner + is_active_member() RLS, so one
 * account can never delete another's data. Idempotent: deleting a row that is
 * already gone succeeds (zero rows, no error).
 *
 * @returns {{ status:"ok"|"skipped", removed:number }}
 */
export async function deleteCloudProject(id, userId) {
  const supabase = getSupabase();
  if (!supabase || !userId || !id) return { status: "skipped", removed: 0 };
  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("owner", userId)
    .select("id");
  if (error) throw error;
  return { status: "ok", removed: data?.length || 0 };
}

/**
 * Permanent, idempotent deletion of a single design for the current scope:
 *  1. Write a durable tombstone FIRST (so the design can't reappear even if a
 *     later step fails or the tab closes).
 *  2. Remove the local IndexedDB record.
 *  3. If the design is owned by this signed-in user, delete the cloud copy.
 *     On cloud failure the tombstone stays `cloudDeleted:false` → reported as
 *     pending and retried by the next pull; NEVER reported as fully deleted.
 *
 * Account isolation: everything operates on the active scope's DB and the
 * owner-scoped cloud delete. Guest/unowned designs skip the cloud step and are
 * reported honestly as device-only.
 *
 * @returns {{ ok:boolean, cloudDeleted:boolean, cloudPending:boolean, scope:"cloud"|"device", error?:string }}
 */
export async function deleteDesign(project, { userId = null, configured = false } = {}) {
  const id = typeof project === "string" ? project : project?.id;
  const attemptCloud = configured && !!userId && isOwnedByUser(project, userId);

  // 1) durable intent, 2) local removal — both before any network call.
  await addTombstone(id, { cloudDeleted: !attemptCloud });
  await deleteProject(id);

  if (!attemptCloud) {
    return { ok: true, cloudDeleted: false, cloudPending: false, scope: "device" };
  }

  // 3) cloud removal (honest about failure).
  try {
    // Capture the asset ids this project referenced BEFORE the cascade removes
    // its pages, so we can later GC the ones no other design still uses.
    let candidateAssetIds = new Set();
    try {
      const supabase = getSupabase();
      const { data: myPages } = await supabase.from("pages").select("doc").eq("project_id", id).eq("owner", userId);
      for (const pg of myPages || []) for (const aId of collectAssetIds(pg.doc)) candidateAssetIds.add(aId);
    } catch { /* non-fatal: skip GC candidates */ }

    await deleteCloudProject(id, userId);
    await setTombstoneCloudDeleted(id, true);

    // Best-effort, owner-scoped, reference-counted Storage cleanup. Never blocks
    // or fails the deletion; shared assets are retained.
    try { await gcOrphanAssets(candidateAssetIds, userId); } catch { /* ignore */ }

    return { ok: true, cloudDeleted: true, cloudPending: false, scope: "cloud" };
  } catch (e) {
    return {
      ok: true, // local deletion succeeded and is permanent (tombstoned)
      cloudDeleted: false,
      cloudPending: true,
      scope: "cloud",
      error: e?.message || "cloud delete failed",
    };
  }
}

/** Record a per-design sync failure without advancing the last-synced marker. */
async function recordSyncError(projectId, message) {
  try {
    await writeSyncState("project", projectId, {
      lastError: String(message || "sync failed"),
      lastErrorAt: Date.now(),
    });
  } catch {
    /* bookkeeping only — never mask the original error */
  }
}

/**
 * Automatic single-project push for the editor/dashboard (owned designs only).
 * Failure-aware: a thrown error is recorded in sync_state (so the dashboard can
 * badge it "Sync failed") and returned as { status:"error" } — never surfaced as
 * success. A "conflict" result is returned as-is for the UI to handle.
 * @returns {{ status:"ok"|"conflict"|"skipped"|"error", error?:string }}
 */
export async function pushProjectSafe(projectId, userId) {
  try {
    const res = await syncPushProject(projectId, userId);
    return res;
  } catch (e) {
    await recordSyncError(projectId, e?.message || e);
    return { status: "error", error: e?.message || String(e) };
  }
}

/**
 * Read the per-project sync bookkeeping for the ACTIVE scope, keyed by project
 * id. Used by the dashboard to badge each design (local / synced / needed /
 * failed) without an extra query per card.
 */
export async function listProjectSyncStates() {
  const db = getDatabase();
  const rows = await db.sync_state.where("kind").equals("project").toArray();
  const byId = {};
  for (const r of rows) byId[r.remoteId] = r;
  return byId;
}

/**
 * Login / dashboard reconciliation for an approved owner. Safe, non-destructive,
 * and self-healing — the core fix for "designs live only in one browser".
 *
 *  1. ADOPT in-scope designs: every design in THIS user's private per-account
 *     IndexedDB (design-studio--u-<uid>) belongs to this user, because that
 *     database is only ever opened while signed in as this user. So any design
 *     there whose ownerScope is missing/wrong (e.g. created during a scope-timing
 *     race, or legacy-imported with a stale scope) is re-stamped to the correct
 *     ownerScope, making it eligible to push. Only this user's own scoped DB is
 *     read — guest and legacy databases (ambiguous ownership) are never touched
 *     or claimed here.
 *  2. PUSH every owned, non-tombstoned design that is not yet confirmed in the
 *     cloud, so local-only designs are persisted to the user's account.
 *
 * Tombstone-aware (never revives a deleted design) and conflict-safe (a cloud
 * copy that is newer is reported as a conflict, never overwritten by stale local
 * data — see syncPushProject).
 *
 * @returns {{ adopted:number, pushed:number, unconfirmed:number, conflicts:number }}
 */
export async function reconcileOnLogin(userId) {
  const supabase = getSupabase();
  if (!supabase || !userId) return { adopted: 0, pushed: 0, unconfirmed: 0, conflicts: 0 };
  const db = getDatabase();
  const scope = ownerScopeForUser(userId);
  const tomb = await listTombstones();
  const all = await db.projects.toArray();

  // 1) Adopt in-scope designs (this user's private DB ⇒ this user's designs).
  let adopted = 0;
  for (const p of all) {
    if (tomb[p.id]) continue; // respect deletions
    if (p.ownerScope !== scope) {
      await db.projects.update(p.id, { ownerScope: scope });
      adopted++;
    }
  }

  // 2) Push every owned, non-tombstoned design not confirmed in the cloud.
  const states = await listProjectSyncStates();
  let pushed = 0;
  let unconfirmed = 0;
  let conflicts = 0;
  for (const p of all) {
    if (tomb[p.id]) continue;
    const proj = { ...p, ownerScope: scope }; // post-adoption view
    if (classifySyncStatus(proj, states[p.id], { configured: true, userId }) === "synced") continue;
    const res = await pushProjectSafe(p.id, userId);
    if (res.status === "ok") pushed++;
    else { unconfirmed++; if (res.status === "conflict") conflicts++; }
  }
  return { adopted, pushed, unconfirmed, conflicts };
}

/**
 * Batch-push the signed-in user's OWN local projects. Internal reconcile helper
 * (there is no manual "Sync now" UI — automatic sync pushes per design); kept as
 * a building block. Designs not owned by this user (guest, legacy, unclaimed, or
 * another account's) are skipped, never uploaded. Failure-aware: a single
 * project's failure is recorded and reported but does not abort the rest of the
 * batch, and a failure is never reported as a success.
 *
 * @returns {{ pushed:number, skipped:number, failed:number, conflicts:string[] }}
 */
export async function syncPushAll(userId, { onProgress } = {}) {
  const supabase = getSupabase();
  if (!supabase || !userId) return { pushed: 0, skipped: 0, failed: 0, conflicts: [] };

  const all = await listProjects();
  const mine = all.filter((p) => isOwnedByUser(p, userId));
  const skipped = all.length - mine.length;
  let pushed = 0;
  let failed = 0;
  const conflicts = [];

  for (let i = 0; i < mine.length; i++) {
    const p = mine[i];
    try {
      const res = await syncPushProject(p, userId);
      if (res.status === "conflict") {
        conflicts.push(p.id);
        await recordSyncError(p.id, "conflict: server has newer changes");
      } else if (res.status === "ok") {
        pushed++;
      }
    } catch (err) {
      failed++;
      await recordSyncError(p.id, err?.message || err);
    }
    onProgress?.({ done: i + 1, total: mine.length });
  }

  return { pushed, skipped, failed, conflicts };
}
