// Device-local "recently viewed templates" — a per-browser convenience ONLY.
// It stores just template catalog IDs (no personal or sensitive data) in
// localStorage, is never synced to the cloud, and is completely separate from
// the user's saved designs. Every access is guarded so private mode / blocked
// storage degrades to "no recents" instead of throwing.

const KEY = "atlas:recent-templates";
const CAP = 12;

/** Most-recent-first list of template IDs (strings only), capped. Safe on SSR. */
export function getRecentTemplateIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => typeof x === "string" && x).slice(0, CAP);
  } catch {
    return [];
  }
}

/** Record a viewed template ID (deduped, moved to the front, capped). */
export function recordTemplateView(id) {
  if (typeof window === "undefined" || typeof id !== "string" || !id) return;
  try {
    const next = [id, ...getRecentTemplateIds().filter((x) => x !== id)].slice(0, CAP);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable (private mode, blocked, quota) — silently ignore */
  }
}

/** Clear the device-local recents. */
export function clearRecentTemplates() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
