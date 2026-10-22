// Pure, dependency-free server-side validation for personal-design payloads.
// Used by the /api/projects route handlers before any database write, so a
// malformed or oversized payload is rejected with a clear error and never
// partially persisted. Kept free of imports so it can be unit-tested directly.

export const LIMITS = {
  NAME_MAX: 200,
  DIM_MIN: 50,
  DIM_MAX: 5000,
  PAGES_MAX: 200,
  PAGE_DOC_BYTES_MAX: 3_000_000, // ~3MB serialized doc per page (refs, not blobs)
  TOTAL_DOC_BYTES_MAX: 24_000_000, // ~24MB across all pages
};

const KNOWN_TYPES = new Set([
  "youtube-thumbnail", "youtube-banner", "instagram-post", "instagram-story",
  "facebook-post", "twitter-post", "presentation", "custom",
  // Video projects: an ordinary project whose page `doc` holds a timeline
  // document (validated client-side via lib/video/document.js). Purely additive —
  // existing types and their validation are unchanged.
  "video",
]);

// Images must be externalized to Storage as asset:// refs before persistence —
// never stored as base64 blobs in Postgres. This catches a doc that still holds
// an embedded data image.
const DATA_IMAGE_RE = /data:image\/[a-zA-Z0-9.+-]+;base64,/;

function isString(v) { return typeof v === "string"; }
function clampInt(n, min, max) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return null;
  return Math.min(max, Math.max(min, v));
}
function cleanName(v, fallback = "Untitled design") {
  if (!isString(v)) return fallback;
  const t = v.trim().slice(0, LIMITS.NAME_MAX);
  return t || fallback;
}
function byteLen(obj) {
  try { return JSON.stringify(obj ?? {}).length; } catch { return Infinity; }
}

/** Validate + normalize a single page. Returns { ok, value } or { ok:false, error }. */
export function validatePage(page, index) {
  if (!page || typeof page !== "object") return { ok: false, error: `Page ${index + 1}: invalid.` };
  const id = isString(page.id) ? page.id : "";
  if (!id) return { ok: false, error: `Page ${index + 1}: missing id.` };
  const width = clampInt(page.width, LIMITS.DIM_MIN, LIMITS.DIM_MAX);
  const height = clampInt(page.height, LIMITS.DIM_MIN, LIMITS.DIM_MAX);
  if (width === null || height === null) return { ok: false, error: `Page ${index + 1}: invalid dimensions.` };
  const doc = page.doc == null ? {} : page.doc;
  if (typeof doc !== "object") return { ok: false, error: `Page ${index + 1}: doc must be an object.` };
  const size = byteLen(doc);
  if (size > LIMITS.PAGE_DOC_BYTES_MAX) return { ok: false, error: `Page ${index + 1}: content too large.` };
  if (DATA_IMAGE_RE.test(JSON.stringify(doc))) {
    return { ok: false, error: `Page ${index + 1}: images must be uploaded to storage, not embedded.` };
  }
  return {
    ok: true,
    value: {
      id,
      name: cleanName(page.name, `Page ${index + 1}`),
      background: isString(page.background) ? page.background.slice(0, 64) : "#ffffff",
      width, height,
      position: Number.isFinite(Number(page.position)) ? Math.max(0, Math.round(Number(page.position))) : index,
      doc,
    },
  };
}

/**
 * Validate + normalize a full project payload (create or update). Identity/owner
 * is NEVER taken from the payload — the route derives it from the session.
 * @returns {{ ok:true, value:object } | { ok:false, error:string }}
 */
export function validateProjectPayload(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid request body." };

  const type = isString(body.type) && KNOWN_TYPES.has(body.type) ? body.type : "custom";
  const width = clampInt(body.width, LIMITS.DIM_MIN, LIMITS.DIM_MAX);
  const height = clampInt(body.height, LIMITS.DIM_MIN, LIMITS.DIM_MAX);
  if (width === null || height === null) return { ok: false, error: "Invalid project dimensions." };

  const pagesIn = Array.isArray(body.pages) ? body.pages : [];
  if (pagesIn.length < 1) return { ok: false, error: "A design needs at least one page." };
  if (pagesIn.length > LIMITS.PAGES_MAX) return { ok: false, error: `Too many pages (max ${LIMITS.PAGES_MAX}).` };

  const pages = [];
  let total = 0;
  for (let i = 0; i < pagesIn.length; i++) {
    const r = validatePage(pagesIn[i], i);
    if (!r.ok) return r;
    total += byteLen(r.value.doc);
    pages.push(r.value);
  }
  if (total > LIMITS.TOTAL_DOC_BYTES_MAX) return { ok: false, error: "Design content is too large to save." };

  const ids = new Set(pages.map((p) => p.id));
  if (ids.size !== pages.length) return { ok: false, error: "Duplicate page ids." };

  const activePageId = isString(body.activePageId) && ids.has(body.activePageId) ? body.activePageId : pages[0].id;

  return {
    ok: true,
    value: {
      name: cleanName(body.name),
      type,
      width, height,
      activePageId,
      pages,
    },
  };
}
