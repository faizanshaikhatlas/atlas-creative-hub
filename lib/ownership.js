// Pure, dependency-free ownership / scope / sync-status / asset-reference helpers
// shared by the local DB layer (lib/db/projects.js) and the sync layer
// (lib/sync/sync.js). Deliberately free of Dexie/Supabase/`@/` imports so the
// core access-control decisions can be unit-tested directly against this real
// source module (not a reimplementation).

const DB_PREFIX = "design-studio";
export const LEGACY_DB_NAME = DB_PREFIX; // the original pre-isolation shared DB
const GUEST_SCOPE = "guest";
export { DB_PREFIX, GUEST_SCOPE };

/** Map a Supabase user id (or null) to a storage-scope token. Never an email. */
export function scopeForUser(userId) {
  return userId ? `u-${userId}` : GUEST_SCOPE;
}

/**
 * The IndexedDB database name for a scope. The bare LEGACY_DB_NAME is
 * unreachable here (every scope name carries the `--` separator), so no active
 * scope can collide with, or write into, the legacy database.
 */
export function dbNameForScope(scope) {
  return `${DB_PREFIX}--${scope || GUEST_SCOPE}`;
}

/** The ownerScope token stamped on designs owned by a given user. */
export function ownerScopeForUser(userId) {
  return `u-${userId}`;
}

/**
 * Whether a local design may be uploaded to `userId`'s cloud account. Eligible
 * ONLY when its ownerScope exactly matches this user's UID scope — guest,
 * unclaimed, legacy, or another account's designs are never eligible.
 */
export function isOwnedByUser(project, userId) {
  if (!project || !userId) return false;
  return project.ownerScope === ownerScopeForUser(userId);
}

/**
 * Classify a design's cloud state for the dashboard (server-confirmation aware).
 * "synced" only after a successful push recorded lastSyncedAt at/after the last
 * local edit — local autosave is never treated as cloud backup.
 * @returns {"local"|"needed"|"synced"|"failed"}
 */
export function classifySyncStatus(project, state, { configured = true, userId = null } = {}) {
  if (!configured || !isOwnedByUser(project, userId)) return "local";
  if (state?.lastError) return "failed";
  if (!state || !state.lastSyncedAt) return "needed";
  if ((project.updatedAt || 0) > (state.lastSyncedAt || 0)) return "needed";
  return "synced";
}

const ASSET_REF_IN_DOC = /asset:\/\/([0-9a-fA-F-]{36})/g;

/** Collect the asset ids referenced inside a page `doc` (object or string). */
export function collectAssetIds(doc) {
  const s = typeof doc === "string" ? doc : JSON.stringify(doc ?? "");
  const ids = new Set();
  let m;
  ASSET_REF_IN_DOC.lastIndex = 0;
  while ((m = ASSET_REF_IN_DOC.exec(s))) ids.add(m[1]);
  return ids;
}

/**
 * Given the asset ids a deleted design referenced and the docs that STILL exist
 * for the owner, return the ids safe to delete — referenced by none of the
 * remaining docs. An asset shared by another design is therefore retained.
 */
export function computeDeletableAssetIds(candidateIds, remainingDocs) {
  const still = new Set();
  for (const d of remainingDocs || []) for (const id of collectAssetIds(d)) still.add(id);
  return [...candidateIds].filter((id) => !still.has(id));
}
