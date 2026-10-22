"use client";

import { apiCreateProject } from "@/lib/designs/client";
import { VIDEO_FORMATS } from "@/lib/video/formats";
import { blankVideoDoc, videoDocFromStarter } from "@/lib/video/document";
import { buildVideoSceneObject } from "@/lib/video/build";

// Create video projects through the EXISTING authenticated, approval-gated,
// owner-scoped API. A video project is a normal project (type "video") whose
// page `doc` holds the timeline document — no new API or schema. The result is an
// independent copy under the signed-in user; the shared starter is never mutated.

function newUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function videoProjectPayload({ name, doc, width, height, background }) {
  const pageId = newUuid();
  return {
    name,
    type: "video",
    width,
    height,
    activePageId: pageId,
    // The timeline doc rides in page.json; pagesToPayload externalizes any images
    // and sends it as the page `doc` (jsonb), exactly like a static design.
    pages: [{ id: pageId, name: "Page 1", json: JSON.stringify(doc), background: background || "#000000", width, height }],
  };
}

export async function createVideoFromStarter(starter, userId) {
  const fmt = VIDEO_FORMATS[starter.format] || VIDEO_FORMATS["yt-video"];
  const sceneDoc = await buildVideoSceneObject(starter);
  const doc = videoDocFromStarter({
    width: fmt.width, height: fmt.height, fps: fmt.fps, duration: starter.durationSec, background: starter.background, sceneDoc,
  });
  const payload = videoProjectPayload({ name: starter.title, doc, width: fmt.width, height: fmt.height, background: starter.background });
  return apiCreateProject(payload, userId);
}

export async function createBlankVideo(formatId, userId) {
  const fmt = VIDEO_FORMATS[formatId] || VIDEO_FORMATS["yt-video"];
  const doc = blankVideoDoc({ width: fmt.width, height: fmt.height, fps: fmt.fps, duration: fmt.defaultDuration });
  const payload = videoProjectPayload({ name: `Untitled ${fmt.label}`, doc, width: fmt.width, height: fmt.height, background: "#000000" });
  return apiCreateProject(payload, userId);
}
