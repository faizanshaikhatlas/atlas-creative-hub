import Dexie from "dexie";
import { scopeForUser, dbNameForScope, LEGACY_DB_NAME, GUEST_SCOPE } from "@/lib/ownership";

/**
 * Local project persistence (IndexedDB via Dexie).
 *
 * Schema v2 (Milestone 3): a project is a MULTI-PAGE document. Each page owns
 * its own serialized Fabric canvas (`json`), `background`, `thumbnail`, and
 * dimensions. The top-level `width`/`height` are the document defaults used for
 * new pages, and the top-level `thumbnail` is the cover (first/active page)
 * shown on the home grid.
 *
 *   project = {
 *     id, name, type, createdAt, updatedAt,
 *     width, height,              // document defaults
 *     thumbnail,                  // cover preview for the home grid
 *     activePageId,
 *     pages: [ { id, name, json, thumbnail, background, width, height } ],
 *     // legacy v1 fields `json`/`thumbnail` are kept after migration as a
 *     // recovery safety net and are otherwise ignored.
 *   }
 */

/**
 * Ordered canvas-size presets shown in the "New design" picker. `id` doubles as
 * the project `type`. Dimensions are in CSS pixels at 1:1.
 */
export const SIZE_PRESETS = [
  { id: "youtube-thumbnail", label: "YouTube Thumbnail", width: 1280, height: 720, group: "YouTube" },
  { id: "youtube-banner", label: "YouTube Banner", width: 2560, height: 1440, group: "YouTube" },
  { id: "instagram-post", label: "Instagram Post", width: 1080, height: 1080, group: "Social" },
  { id: "instagram-story", label: "Instagram Story", width: 1080, height: 1920, group: "Social" },
  { id: "facebook-post", label: "Facebook Post", width: 1200, height: 630, group: "Social" },
  { id: "twitter-post", label: "X / Twitter Post", width: 1600, height: 900, group: "Social" },
  { id: "presentation", label: "Presentation 16:9", width: 1920, height: 1080, group: "Other" },
];

// Keyed lookup (also used by the v2 migration's fallback dimensions).
export const PROJECT_TYPES = Object.fromEntries(
  SIZE_PRESETS.map((p) => [p.id, p])
);

// Guardrails for custom dimensions (keeps the backing canvas sane).
export const MIN_DIM = 50;
export const MAX_DIM = 5000;

export function clampDim(n, fallback) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(MAX_DIM, Math.max(MIN_DIM, v));
}

const DEFAULT_BG = "#ffffff";

/* --------------------- account-scoped local storage --------------------- */
// Local designs are isolated per authenticated identity so one browser never
// mixes two accounts' designs. The active scope is the signed-in user's
// immutable Supabase UID (never their email), or "guest" when signed out. Each
// scope gets its own IndexedDB database.
//
// The original pre-isolation database was named exactly "design-studio" (no
// suffix). It is treated as READ-ONLY LEGACY: no active scope can ever open it,
// it is never written to, deleted, or auto-migrated, and its designs are
// recovered only through an explicit, user-initiated import (see below).

// Scope/naming helpers live in the dependency-free lib/ownership module so they
// can be unit-tested directly; re-exported here for existing importers.
export { scopeForUser, dbNameForScope, LEGACY_DB_NAME };

let activeScope = GUEST_SCOPE;
const instancesByScope = new Map(); // scope -> Dexie instance (one per account)

/**
 * Apply the full v1..v6 schema to a Dexie instance. Shared by every scoped and
 * legacy database so the structure (and the v1→v2 multi-page upgrade) is
 * identical everywhere. A brand-new scoped database simply opens at v6.
 */
function defineSchema(db) {
  // v1: single-page projects.
  db.version(1).stores({ projects: "id, name, type, updatedAt" });

  // v2: multi-page. Data-only upgrade; each v1 canvas becomes pages[0] verbatim
  // (nothing inside a design is lost). Legacy `json`/`thumbnail` are kept as a
  // fallback. (Only ever runs on the legacy DB; scoped DBs are born at v6.)
  db.version(2)
    .stores({ projects: "id, name, type, updatedAt" })
    .upgrade((tx) =>
      tx
        .table("projects")
        .toCollection()
        .modify((p) => {
          if (Array.isArray(p.pages) && p.pages.length) return; // already v2
          const page = {
            id: newId(),
            name: "Page 1",
            json: p.json ?? null,
            thumbnail: p.thumbnail ?? null,
            background: DEFAULT_BG,
            width: p.width ?? PROJECT_TYPES["youtube-thumbnail"].width,
            height: p.height ?? PROJECT_TYPES["youtube-thumbnail"].height,
          };
          p.pages = [page];
          p.activePageId = page.id;
        })
    );

  // v3..v6: additive stores only (components, sync bookkeeping, uploads, brand
  // kits). No destructive migration at any step.
  db.version(3).stores({
    projects: "id, name, type, updatedAt",
    components: "id, name, createdAt",
  });
  db.version(4).stores({
    projects: "id, name, type, updatedAt",
    components: "id, name, createdAt",
    sync_state: "key, kind, remoteId",
    sync_queue: "++seq, status, nextAttemptAt",
  });
  db.version(5).stores({
    projects: "id, name, type, updatedAt",
    components: "id, name, createdAt",
    sync_state: "key, kind, remoteId",
    sync_queue: "++seq, status, nextAttemptAt",
    uploads: "id, createdAt",
  });
  db.version(6).stores({
    projects: "id, name, type, updatedAt",
    components: "id, name, createdAt",
    sync_state: "key, kind, remoteId",
    sync_queue: "++seq, status, nextAttemptAt",
    uploads: "id, createdAt",
    brand_kits: "id, name, createdAt",
  });

  // v7 (deletion tombstones): additive store ONLY. Records that a design was
  // explicitly deleted so it can never silently reappear from a legacy import or
  // a cloud pull. Keyed by the design id; `cloudDeleted` tracks whether the
  // owner's cloud copy has been removed yet (false = still pending/failed, so the
  // next sync retries). Per-account by construction (each scope is its own DB).
  db.version(7).stores({
    projects: "id, name, type, updatedAt",
    components: "id, name, createdAt",
    sync_state: "key, kind, remoteId",
    sync_queue: "++seq, status, nextAttemptAt",
    uploads: "id, createdAt",
    brand_kits: "id, name, createdAt",
    deletions: "id, ownerScope, deletedAt, cloudDeleted",
  });

  // Upgrade resilience (no data is ever deleted):
  // - versionchange: another tab opened a newer schema — close this connection
  //   so its upgrade isn't blocked.
  // - blocked: surface a clear warning instead of a silent hang.
  db.on("versionchange", () => {
    try { db.close(); } catch { /* ignore */ }
  });
  db.on("blocked", () => {
    console.warn(
      "[design-studio] IndexedDB upgrade is blocked by another open ATLAS tab. " +
        "Close other tabs of this app and reload to finish the upgrade."
    );
  });
}

function openDbNamed(name) {
  if (typeof window === "undefined") {
    throw new Error("The project database is only available in the browser.");
  }
  const db = new Dexie(name);
  defineSchema(db);
  return db;
}

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("The project database is only available in the browser.");
  }
  let db = instancesByScope.get(activeScope);
  if (!db) {
    db = openDbNamed(dbNameForScope(activeScope));
    instancesByScope.set(activeScope, db);
  }
  return db;
}

/**
 * Point all subsequent local reads/writes at the given account scope. Call this
 * on every auth transition: sign-in, sign-out, account switch, and session
 * restore. Returns true when the active scope actually changed, so callers can
 * refresh the UI. Switching scope never deletes or migrates any database.
 */
export function setDbScope(scope) {
  const next = scope || GUEST_SCOPE;
  if (next === activeScope) return false;
  activeScope = next;
  return true;
}

/** The scope local reads/writes currently target (e.g. "guest" or "u-<uid>"). */
export function getDbScope() {
  return activeScope;
}

/** Shared Dexie instance for the ACTIVE scope (also used by the sync layer). */
export function getDatabase() {
  return getDb();
}

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createBlankPage({ name, width, height } = {}) {
  return {
    id: newId(),
    name: name || "Page",
    json: null,
    thumbnail: null,
    background: DEFAULT_BG,
    width,
    height,
    guides: [],
  };
}

/**
 * Defensive runtime normalization. Guarantees a usable `pages` array and a
 * valid `activePageId` even for a record that somehow predates the migration
 * (e.g. opened in a tab that upgraded mid-session). Pure — returns a new object.
 */
export function normalizeProject(project) {
  if (!project) return project;
  let pages = Array.isArray(project.pages) ? project.pages : null;
  if (!pages || !pages.length) {
    pages = [
      {
        id: newId(),
        name: "Page 1",
        json: project.json ?? null,
        thumbnail: project.thumbnail ?? null,
        background: DEFAULT_BG,
        width: project.width ?? PROJECT_TYPES["youtube-thumbnail"].width,
        height: project.height ?? PROJECT_TYPES["youtube-thumbnail"].height,
      },
    ];
  }
  const activePageId = pages.some((p) => p.id === project.activePageId)
    ? project.activePageId
    : pages[0].id;
  return { ...project, pages, activePageId };
}

export async function createProject({ name, type = "youtube-thumbnail", width, height } = {}) {
  const preset = PROJECT_TYPES[type] || PROJECT_TYPES["youtube-thumbnail"];
  const w = clampDim(width, preset.width);
  const h = clampDim(height, preset.height);
  const now = Date.now();
  const firstPage = createBlankPage({ name: "Page 1", width: w, height: h });
  const project = {
    id: newId(),
    name: name || "Untitled design",
    type,
    width: w,
    height: h,
    thumbnail: null,
    pages: [firstPage],
    activePageId: firstPage.id,
    createdAt: now,
    updatedAt: now,
    // The account that owns this local design. Only designs whose ownerScope
    // matches the signed-in user are ever uploaded by the sync layer.
    ownerScope: activeScope,
  };
  await getDb().projects.add(project);
  return project;
}

export async function getProject(id) {
  if (!id) return undefined;
  const p = await getDb().projects.get(id);
  return p ? normalizeProject(p) : p;
}

export async function listProjects() {
  const all = await getDb().projects.toArray();
  return all
    .map(normalizeProject)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * Persist page-level changes. `pages` and `activePageId` are the multi-page
 * payload; `thumbnail` is the cover for the home grid.
 */
export async function saveProject(id, { pages, activePageId, thumbnail, name } = {}) {
  const patch = { updatedAt: Date.now() };
  if (pages !== undefined) patch.pages = pages;
  if (activePageId !== undefined) patch.activePageId = activePageId;
  if (thumbnail !== undefined) patch.thumbnail = thumbnail;
  if (name !== undefined) patch.name = name;
  await getDb().projects.update(id, patch);
  return patch;
}

export async function renameProject(id, name) {
  await getDb().projects.update(id, { name, updatedAt: Date.now() });
}

/**
 * Set a design's tags (for organizing/filtering on the dashboard). Tags are a
 * plain string array stored on the record — additive, no schema change. Tagging
 * does not touch `updatedAt`, so it won't disturb "last edited" ordering.
 */
export async function setProjectTags(id, tags) {
  const clean = Array.isArray(tags)
    ? [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 12)
    : [];
  await getDb().projects.update(id, { tags: clean });
  return clean;
}

export async function deleteProject(id) {
  await getDb().projects.delete(id);
}

/* --------------------------- deletion tombstones --------------------------- */
// A tombstone marks a design as intentionally deleted in the ACTIVE scope so it
// can never be resurrected by a legacy import or a cloud pull. Tombstones are
// durable and retained; they are tiny (id + timestamp + a flag).

/**
 * Record (or refresh) a tombstone for a deleted design. `cloudDeleted` is true
 * when there is nothing to remove in the cloud (guest/never-synced) or the cloud
 * copy is already gone; false means a cloud delete is still pending and the next
 * sync should retry. Idempotent (a repeat call just overwrites).
 */
export async function addTombstone(id, { cloudDeleted = false } = {}) {
  const db = getDb();
  if (!db.deletions) {
    throw new Error("Deletion store is not ready yet — please reload the page to finish the database upgrade.");
  }
  await db.deletions.put({ id, ownerScope: activeScope, deletedAt: Date.now(), cloudDeleted: !!cloudDeleted });
}

/** Flag a tombstone's cloud copy as removed (clears the pending-retry state). */
export async function setTombstoneCloudDeleted(id, value = true) {
  const db = getDb();
  if (!db.deletions) return;
  await db.deletions.update(id, { cloudDeleted: !!value });
}

/** All tombstones in the active scope, keyed by design id. */
export async function listTombstones() {
  const db = getDb();
  if (!db.deletions) return {};
  const rows = await db.deletions.toArray();
  const byId = {};
  for (const r of rows) byId[r.id] = r;
  return byId;
}

/** Set of tombstoned design ids in the active scope. */
export async function listTombstoneIds() {
  const db = getDb();
  if (!db.deletions) return new Set();
  const rows = await db.deletions.toArray();
  return new Set(rows.map((r) => r.id));
}

/**
 * Duplicate a project into a brand-new independent record. Pages get fresh ids
 * (so the copy's pages never collide with the original), content/backgrounds are
 * copied verbatim, and timestamps are reset. The original is untouched.
 */
export async function duplicateProject(id) {
  const src = await getProject(id);
  if (!src) return null;
  const now = Date.now();
  const idMap = new Map();
  const pages = (src.pages || []).map((p) => {
    const nid = newId();
    idMap.set(p.id, nid);
    return { ...p, id: nid };
  });
  const copy = {
    ...src,
    id: newId(),
    name: `${src.name || "Untitled design"} copy`,
    pages,
    activePageId: idMap.get(src.activePageId) || pages[0]?.id || null,
    createdAt: now,
    updatedAt: now,
    // A duplicate belongs to whoever is active now (not the source's scope).
    ownerScope: activeScope,
  };
  await getDb().projects.add(copy);
  return copy;
}

/* ------------------------- reusable components ------------------------- */

export async function saveComponent({ name, objects, thumbnail } = {}) {
  const comp = {
    id: newId(),
    name: name || "Component",
    objects: objects || [],
    thumbnail: thumbnail || null,
    createdAt: Date.now(),
  };
  await getDb().components.add(comp);
  return comp;
}

export async function listComponents() {
  const all = await getDb().components.toArray();
  return all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function deleteComponent(id) {
  await getDb().components.delete(id);
}

/* ------------------------- uploads library ------------------------- */
// Reusable device images, stored locally (no login / cloud). Each record holds
// a data URL plus light metadata so uploads can be re-inserted into any design.

export async function saveUpload({ name, dataUrl, width, height, bytes } = {}) {
  if (!dataUrl) throw new Error("An image data URL is required.");
  const upload = {
    id: newId(),
    name: name || "Upload",
    dataUrl,
    width: width ?? null,
    height: height ?? null,
    bytes: bytes ?? null,
    createdAt: Date.now(),
  };
  await getDb().uploads.add(upload);
  return upload;
}

export async function listUploads() {
  const all = await getDb().uploads.toArray();
  return all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function deleteUpload(id) {
  await getDb().uploads.delete(id);
}

/* --------------------------- brand kits ---------------------------- */
// Reusable brand settings, stored locally. A kit = { colors[], headingFont,
// bodyFont, logos[] (data URLs) }. The built-in ATLAS kit is the default and
// lives in code (see BrandKitPanel); these are the user's own saved kits.

export async function saveBrandKit({ name, colors, headingFont, bodyFont, logos } = {}) {
  const kit = {
    id: newId(),
    name: name || "Brand kit",
    colors: Array.isArray(colors) ? colors : [],
    headingFont: headingFont || null,
    bodyFont: bodyFont || null,
    logos: Array.isArray(logos) ? logos : [],
    createdAt: Date.now(),
  };
  const db = getDb();
  // Guard against a stale DB instance (e.g. preserved across a dev hot-reload)
  // that predates the brand_kits store, turning a cryptic TypeError into an
  // actionable message. A full page reload rebuilds the instance at v6.
  if (!db.brand_kits) {
    throw new Error("Brand kit store is not ready yet — please reload the page to finish the database upgrade.");
  }
  await db.brand_kits.add(kit);
  return kit;
}

export async function listBrandKits() {
  const all = await getDb().brand_kits.toArray();
  return all.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export async function updateBrandKit(id, patch = {}) {
  const db = getDb();
  if (!db.brand_kits) {
    throw new Error("Brand kit store is not ready yet — please reload the page to finish the database upgrade.");
  }
  const clean = {};
  if (patch.name !== undefined) clean.name = String(patch.name).trim() || "Brand kit";
  if (patch.colors !== undefined) clean.colors = Array.isArray(patch.colors) ? patch.colors.filter(Boolean).slice(0, 16) : [];
  if (patch.headingFont !== undefined) clean.headingFont = patch.headingFont || null;
  if (patch.bodyFont !== undefined) clean.bodyFont = patch.bodyFont || null;
  if (patch.logos !== undefined) clean.logos = Array.isArray(patch.logos) ? patch.logos.slice(0, 24) : [];
  await db.brand_kits.update(id, clean);
  return clean;
}

export async function deleteBrandKit(id) {
  await getDb().brand_kits.delete(id);
}

/* --------------------------- legacy recovery --------------------------- */
// The pre-isolation database ("design-studio", no scope suffix) held every
// account's designs in one shared namespace. It is opened READ-ONLY here for an
// explicit, user-initiated import and is never written to or deleted — so the
// recovery is repeatable and nothing is ever lost.

function openLegacyDb() {
  return openDbNamed(LEGACY_DB_NAME);
}

/**
 * Count the designs in the legacy database (0 when it doesn't exist or can't be
 * read). Uses Dexie.exists so a missing legacy DB isn't created as a side effect.
 */
export async function countLegacyDesigns() {
  if (typeof window === "undefined") return 0;
  try {
    const exists = await Dexie.exists(LEGACY_DB_NAME);
    if (!exists) return 0;
  } catch {
    /* fall through and attempt to open */
  }
  let db;
  try {
    db = openLegacyDb();
    return await db.projects.count();
  } catch {
    return 0;
  } finally {
    try { db?.close(); } catch { /* ignore */ }
  }
}

/** Read legacy designs (normalized) WITHOUT modifying the legacy database. */
export async function listLegacyProjects() {
  const db = openLegacyDb();
  try {
    const all = await db.projects.toArray();
    return all.map(normalizeProject).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
}

/**
 * Explicitly import legacy designs into the CURRENT active scope. This is the
 * user's deliberate claim of those designs:
 *  - Imported while signed in  → ownerScope = that user (so they become
 *    syncable to that account).
 *  - Imported as a guest        → ownerScope = "guest" (stays local-only).
 *
 * The legacy database is left untouched (non-destructive, repeatable). Existing
 * ids are preserved so a re-sync by the original owner is idempotent; a design
 * already present in the target scope is skipped, never overwritten.
 *
 * @returns {{ imported: number, skipped: number, scope: string }}
 */
export async function importLegacyDesigns() {
  const legacy = await listLegacyProjects();
  const db = getDb();
  // Deletion-aware: never re-import a design the user has deleted in this scope,
  // even though the legacy source still holds it.
  const tombstoned = await listTombstoneIds();
  let imported = 0;
  let skipped = 0;
  for (const p of legacy) {
    if (tombstoned.has(p.id)) { skipped++; continue; }
    const exists = await db.projects.get(p.id);
    if (exists) { skipped++; continue; }
    await db.projects.add({
      ...p,
      ownerScope: activeScope,
      importedFrom: "legacy",
      importedAt: Date.now(),
    });
    imported++;
  }
  return { imported, skipped, scope: activeScope };
}
