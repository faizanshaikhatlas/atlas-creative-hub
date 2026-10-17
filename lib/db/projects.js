import Dexie from "dexie";

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

let dbInstance = null;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("The project database is only available in the browser.");
  }
  if (!dbInstance) {
    dbInstance = new Dexie("design-studio");

    // v1: single-page projects.
    dbInstance.version(1).stores({
      projects: "id, name, type, updatedAt",
    });

    // v2: multi-page. Indexes are unchanged, so this is a data-only upgrade.
    // Each v1 record's single canvas becomes pages[0] verbatim — the Fabric
    // JSON string (object ids, layers, groups, lock/hide, all props) is moved
    // without inspection, so nothing inside a design is lost. The legacy
    // `json`/`thumbnail` fields are intentionally left in place as a fallback.
    dbInstance
      .version(2)
      .stores({
        projects: "id, name, type, updatedAt",
      })
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

    // v3: add a store for reusable saved components. No data migration — the
    // new store simply appears; existing projects are untouched.
    dbInstance.version(3).stores({
      projects: "id, name, type, updatedAt",
      components: "id, name, createdAt",
    });

    // v4 (cloud sync): additive stores ONLY. Existing `projects`/`components`
    // are declared unchanged so their data is preserved verbatim. These two new
    // stores back optional Supabase sync and are empty/irrelevant when cloud is
    // off, so local-first behavior is untouched.
    //   sync_state: per-entity sync bookkeeping, keyed by "kind:id"
    //   sync_queue: durable outbox of pending push ops (retry/backoff survive reloads)
    dbInstance.version(4).stores({
      projects: "id, name, type, updatedAt",
      components: "id, name, createdAt",
      sync_state: "key, kind, remoteId",
      sync_queue: "++seq, status, nextAttemptAt",
    });

    // v5 (uploads library): additive store ONLY. A reusable device-image library
    // so an upload can be dropped into any design. Existing stores are declared
    // unchanged, so all prior projects/components/sync data is preserved verbatim.
    dbInstance.version(5).stores({
      projects: "id, name, type, updatedAt",
      components: "id, name, createdAt",
      sync_state: "key, kind, remoteId",
      sync_queue: "++seq, status, nextAttemptAt",
      uploads: "id, createdAt",
    });

    // v6 (brand kits): additive store ONLY. Reusable brand settings (colors,
    // font pairing, logos) saved locally; multiple kits supported. Existing
    // stores re-declared unchanged so all prior data is preserved.
    dbInstance.version(6).stores({
      projects: "id, name, type, updatedAt",
      components: "id, name, createdAt",
      sync_state: "key, kind, remoteId",
      sync_queue: "++seq, status, nextAttemptAt",
      uploads: "id, createdAt",
      brand_kits: "id, name, createdAt",
    });

    // Upgrade resilience (no data is ever deleted):
    // - versionchange: another tab opened a newer schema version — close this
    //   connection so its upgrade isn't blocked. Without this, a v5→v6 upgrade
    //   can be blocked by an older open tab, making writes to the new
    //   `brand_kits`/`uploads` stores reject with a storage error.
    // - blocked: surface a clear console warning instead of a silent hang.
    dbInstance.on("versionchange", () => {
      try { dbInstance.close(); } catch { /* ignore */ }
    });
    dbInstance.on("blocked", () => {
      console.warn(
        "[design-studio] IndexedDB upgrade is blocked by another open ATLAS tab. " +
          "Close other tabs of this app and reload to finish the upgrade."
      );
    });
  }
  return dbInstance;
}

/** Shared Dexie instance (also used by the sync layer). Browser-only. */
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

export async function deleteProject(id) {
  await getDb().projects.delete(id);
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

export async function deleteBrandKit(id) {
  await getDb().brand_kits.delete(id);
}
