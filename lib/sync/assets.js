"use client";

import { getSupabase, DESIGNS_BUCKET } from "@/lib/supabase/client";

/**
 * Asset extraction/resolution for cloud sync.
 *
 * Push side: base64 data URLs embedded in a Fabric document are expensive to
 * keep in Postgres, so we lift them into Storage (content-addressed by sha256)
 * and replace the data URL in the JSON with a compact `asset://<assetId>` ref.
 *
 * Pull side: `asset://<id>` refs are resolved back to short-lived signed URLs
 * so Fabric can render them.
 *
 * Nothing here runs unless cloud is configured and the caller passes a userId.
 */

const DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/;
const ASSET_REF_RE = /^asset:\/\/([0-9a-fA-F-]{36})$/;

/**
 * Extract our own Storage object path (`<uid>/assets/<hash>.<ext>`) from a signed
 * or public URL for the designs bucket, so a design reloaded from the cloud (whose
 * images are transient signed URLs) can be re-saved as stable `asset://` refs —
 * never persisting an expiring URL. Returns null for anything else. Pure.
 */
export function signedUrlToStoragePath(str, bucket = DESIGNS_BUCKET) {
  if (typeof str !== "string") return null;
  const m = str.match(new RegExp(`/storage/v1/object/(?:sign|public|authenticated)/${bucket}/([^?#]+)`));
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

const MIME_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function dataUrlToBytes(dataUrl) {
  const m = DATA_URL_RE.exec(dataUrl);
  if (!m) return null;
  const mime = m[1];
  const binary = atob(m[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mime, bytes };
}

/**
 * Recursively walk a JSON value, invoking `onString(value)` for every string
 * and substituting its (possibly async) return value. Returns a new structure;
 * the input is not mutated.
 */
async function deepMapStrings(value, onString) {
  if (typeof value === "string") return onString(value);
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) out.push(await deepMapStrings(item, onString));
    return out;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await deepMapStrings(v, onString);
    return out;
  }
  return value;
}

/**
 * Upload every embedded image in `doc` to Storage (deduped) and return a new
 * doc with data URLs replaced by `asset://<id>` refs.
 *
 * @returns {{ doc: object, assetIds: string[] }}
 */
export async function externalizeAssets(doc, userId) {
  const supabase = getSupabase();
  if (!supabase || !userId || doc == null) return { doc, assetIds: [] };

  const parsed = typeof doc === "string" ? JSON.parse(doc) : doc;
  const assetIds = new Set();
  const cacheByHash = new Map(); // sha256 -> assetId (within this call)
  const cacheByPath = new Map(); // storage_path -> assetId (within this call)

  const mapped = await deepMapStrings(parsed, async (str) => {
    // A design reloaded from the cloud carries signed URLs for its images. Map
    // them back to the stable asset:// ref (by storage path) so we never persist
    // an expiring URL. (asset:// refs already in the doc fall through unchanged.)
    const storagePath = signedUrlToStoragePath(str);
    if (storagePath) {
      if (cacheByPath.has(storagePath)) { const id = cacheByPath.get(storagePath); assetIds.add(id); return `asset://${id}`; }
      const { data: row } = await supabase
        .from("assets").select("id").eq("owner", userId).eq("storage_path", storagePath).maybeSingle();
      if (row?.id) { cacheByPath.set(storagePath, row.id); assetIds.add(row.id); return `asset://${row.id}`; }
      return str; // unknown path — leave as-is rather than guess
    }
    if (!str.startsWith("data:image/")) return str;
    const decoded = dataUrlToBytes(str);
    if (!decoded) return str; // not a base64 image we handle; leave as-is
    const { mime, bytes } = decoded;
    const hash = await sha256Hex(bytes);

    if (cacheByHash.has(hash)) {
      assetIds.add(cacheByHash.get(hash));
      return `asset://${cacheByHash.get(hash)}`;
    }

    // Is this asset already recorded for this user? (sha256 is unique per owner)
    const { data: existing, error: selErr } = await supabase
      .from("assets")
      .select("id")
      .eq("owner", userId)
      .eq("sha256", hash)
      .maybeSingle();
    if (selErr) throw selErr;

    let assetId = existing?.id;
    if (!assetId) {
      const ext = MIME_EXT[mime] || "bin";
      const storagePath = `${userId}/assets/${hash}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(DESIGNS_BUCKET)
        .upload(storagePath, new Blob([bytes], { type: mime }), {
          upsert: true,
          contentType: mime,
        });
      if (upErr) throw upErr;

      const { data: inserted, error: insErr } = await supabase
        .from("assets")
        .insert({ owner: userId, storage_path: storagePath, mime, bytes: bytes.length, sha256: hash })
        .select("id")
        .single();
      if (insErr) throw insErr;
      assetId = inserted.id;
    }

    cacheByHash.set(hash, assetId);
    assetIds.add(assetId);
    return `asset://${assetId}`;
  });

  return { doc: mapped, assetIds: [...assetIds] };
}

/**
 * Replace `asset://<id>` refs in a doc with fresh signed URLs so Fabric can
 * render the images locally.
 */
export async function internalizeAssets(doc, userId, { expiresIn = 3600 } = {}) {
  const supabase = getSupabase();
  if (!supabase || !userId || doc == null) return doc;

  const parsed = typeof doc === "string" ? JSON.parse(doc) : doc;

  // Collect asset ids first, resolve paths + signed URLs in batch.
  const ids = new Set();
  await deepMapStrings(parsed, (str) => {
    const m = ASSET_REF_RE.exec(str);
    if (m) ids.add(m[1]);
    return str;
  });
  if (ids.size === 0) return parsed;

  const { data: rows, error } = await supabase
    .from("assets")
    .select("id, storage_path")
    .in("id", [...ids]);
  if (error) throw error;

  const urlById = new Map();
  for (const row of rows || []) {
    const { data: signed, error: signErr } = await supabase.storage
      .from(DESIGNS_BUCKET)
      .createSignedUrl(row.storage_path, expiresIn);
    if (signErr) throw signErr;
    urlById.set(row.id, signed.signedUrl);
  }

  return deepMapStrings(parsed, (str) => {
    const m = ASSET_REF_RE.exec(str);
    if (m && urlById.has(m[1])) return urlById.get(m[1]);
    return str;
  });
}
