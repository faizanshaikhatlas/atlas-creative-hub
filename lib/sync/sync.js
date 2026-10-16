"use client";

import { getSupabase } from "@/lib/supabase/client";
import { getDatabase, getProject, listProjects, normalizeProject } from "@/lib/db/projects";
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

  let pulled = 0;
  const conflicts = [];

  for (const row of projects || []) {
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

/** Push every local project (initial opt-in "Sync to cloud"). */
export async function syncPushAll(userId, { onProgress } = {}) {
  const supabase = getSupabase();
  if (!supabase || !userId) return { pushed: 0, conflicts: [] };
  const projects = await listProjects();
  let pushed = 0;
  const conflicts = [];
  for (let i = 0; i < projects.length; i++) {
    const res = await syncPushProject(projects[i], userId);
    if (res.status === "conflict") conflicts.push(projects[i].id);
    else if (res.status === "ok") pushed++;
    onProgress?.({ done: i + 1, total: projects.length });
  }
  return { pushed, conflicts };
}
