"use client";

import { externalizeAssets, internalizeAssets } from "@/lib/sync/assets";

/**
 * Browser-side data layer for personal designs. All authoritative project/page
 * records go through the authenticated server API (owner derived from session,
 * RLS + approval enforced server-side). Image blobs are externalized to private
 * Storage here (owner-scoped via RLS) so the server only stores compact
 * `asset://` refs — never base64 in Postgres. On load, refs resolve to
 * short-lived signed URLs for rendering.
 */

async function toError(res) {
  let body = {};
  try { body = await res.json(); } catch { /* ignore */ }
  const err = new Error(body?.error || `request_failed_${res.status}`);
  err.status = res.status;
  err.code = body?.error;
  if (body?.serverUpdatedAt) err.serverUpdatedAt = body.serverUpdatedAt;
  return err;
}

/** List the signed-in user's projects (metadata for the dashboard). */
export async function apiListProjects() {
  const res = await fetch("/api/projects", { cache: "no-store" });
  if (!res.ok) throw await toError(res);
  const { projects } = await res.json();
  return projects || [];
}

/** Load one project and rebuild the editor-shaped project object (pages w/ json). */
export async function apiGetProject(id, userId) {
  const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
  if (!res.ok) throw await toError(res);
  const { project, pages } = await res.json();
  const outPages = [];
  for (const pg of pages || []) {
    const json = await internalizeAssets(pg.doc ?? {}, userId); // asset:// → signed URLs
    outPages.push({
      id: pg.id,
      name: pg.name,
      background: pg.background || "#ffffff",
      width: pg.width,
      height: pg.height,
      json: json ? JSON.stringify(json) : null,
      thumbnail: null, // regenerated client-side on open
    });
  }
  return {
    id: project.id,
    name: project.name,
    type: project.type,
    width: project.width,
    height: project.height,
    activePageId: project.active_page_id,
    updatedAt: project.updated_at,
    pages: outPages,
  };
}

/** Externalize each page's canvas JSON into a persistable doc (refs, no blobs). */
async function pagesToPayload(pages, userId) {
  const out = [];
  for (let i = 0; i < (pages || []).length; i++) {
    const p = pages[i];
    const { doc } = await externalizeAssets(p.json ?? {}, userId);
    let safeDoc = doc;
    if (typeof safeDoc === "string") { try { safeDoc = JSON.parse(safeDoc); } catch { safeDoc = {}; } }
    out.push({
      id: p.id,
      name: p.name || `Page ${i + 1}`,
      background: p.background || "#ffffff",
      width: p.width,
      height: p.height,
      position: i,
      doc: safeDoc ?? {},
    });
  }
  return out;
}

/** Create a new project server-side (server-confirmed). Returns { id, updatedAt }. */
export async function apiCreateProject({ id, name, type, width, height, activePageId, pages }, userId) {
  const payloadPages = await pagesToPayload(pages, userId);
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, name, type, width, height, activePageId, pages: payloadPages }),
  });
  if (!res.ok) throw await toError(res);
  return res.json();
}

/** Update a project (server-confirmed, stale-guarded). Returns { updatedAt }. */
export async function apiUpdateProject(id, { name, type, width, height, activePageId, pages }, { userId, expectedUpdatedAt } = {}) {
  const payloadPages = await pagesToPayload(pages, userId);
  const res = await fetch(`/api/projects/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, type, width, height, activePageId, pages: payloadPages, expectedUpdatedAt }),
  });
  if (!res.ok) throw await toError(res);
  return res.json();
}

/** Delete a project (idempotent, owner-scoped). */
export async function apiDeleteProject(id) {
  const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
  if (!res.ok) throw await toError(res);
  return res.json();
}
