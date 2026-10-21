"use client";

import { listProjectsInDb, dbNameForScope, scopeForUser, LEGACY_DB_NAME } from "@/lib/db/projects";
import { apiCreateProject } from "@/lib/designs/client";

/**
 * Explicit, non-destructive recovery of browser-only designs into the signed-in
 * account. READS local IndexedDB only — it never deletes, clears, or mutates any
 * local database. Imports are the user's deliberate choice (never auto-claimed),
 * and are performed through the authenticated server API so ownership is derived
 * from the session and RLS applies. Ambiguous sources (guest / legacy) are shown
 * separately and clearly labeled.
 */

function newUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Fallback (older browsers): RFC-4122-ish v4.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Enumerate designs found in the local databases on this device, grouped by
 * source. Returns only non-empty sources.
 * @returns {Promise<Array<{ key, label, name, ambiguous, designs: Array }>>}
 */
export async function enumerateLocalDesigns(userId) {
  const sources = [];
  if (userId) {
    sources.push({ key: "account", label: "Saved on this device while signed in to your account", name: dbNameForScope(scopeForUser(userId)), ambiguous: false });
  }
  sources.push({ key: "guest", label: "Saved while signed out (guest) on this device", name: dbNameForScope(scopeForUser(null)), ambiguous: true });
  sources.push({ key: "legacy", label: "Older designs saved before account separation", name: LEGACY_DB_NAME, ambiguous: true });

  const out = [];
  const seenNames = new Set();
  for (const s of sources) {
    if (seenNames.has(s.name)) continue;
    seenNames.add(s.name);
    let designs = [];
    try { designs = await listProjectsInDb(s.name); } catch { designs = []; }
    if (designs.length) {
      out.push({
        ...s,
        designs: designs.map((d) => ({
          id: d.id,
          name: d.name || "Untitled design",
          type: d.type,
          width: d.width,
          height: d.height,
          updatedAt: d.updatedAt,
          pageCount: Array.isArray(d.pages) ? d.pages.length : 0,
        })),
      });
    }
  }
  return out;
}

/**
 * Import selected designs from one source database into the authenticated
 * account. Each import becomes a NEW, independent cloud design with fresh UUIDs
 * (so legacy non-UUID ids are safe and nothing collides). The source database is
 * never modified. Returns a per-design result.
 * @returns {Promise<Array<{ id, ok, newId?, error? }>>}
 */
export async function importDesignsFromDb(sourceName, ids, userId) {
  if (!userId) throw new Error("Sign in to import designs into your account.");
  const designs = await listProjectsInDb(sourceName); // read-only
  const byId = new Map(designs.map((d) => [d.id, d]));
  const results = [];
  for (const id of ids) {
    const d = byId.get(id);
    if (!d) { results.push({ id, ok: false, error: "not_found" }); continue; }
    const pages = (d.pages || []).map((p, i) => ({
      id: newUuid(),
      name: p.name || `Page ${i + 1}`,
      json: p.json ?? null,
      background: p.background || "#ffffff",
      width: p.width,
      height: p.height,
    }));
    try {
      const res = await apiCreateProject(
        { name: d.name || "Untitled design", type: d.type || "custom", width: d.width, height: d.height, activePageId: pages[0]?.id, pages },
        userId
      );
      results.push({ id, ok: true, newId: res.id });
    } catch (e) {
      results.push({ id, ok: false, error: e?.code || e?.message || "import_failed" });
    }
  }
  return results;
}
