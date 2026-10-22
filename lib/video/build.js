"use client";

import { StaticCanvas } from "fabric";
import { SERIALIZE_PROPS } from "@/lib/template-catalog/formats";
import { VIDEO_FORMATS } from "@/lib/video/formats";

// Browser-only Fabric helpers for video scenes.

/** Build a starter's opening-frame composition as a serializable Fabric object
 *  (the scene's editable content). No base64 — starters are pure vector. */
export async function buildVideoSceneObject(starter) {
  const fmt = VIDEO_FORMATS[starter.format] || VIDEO_FORMATS["yt-video"];
  const el = document.createElement("canvas");
  const sc = new StaticCanvas(el, { width: fmt.width, height: fmt.height, backgroundColor: starter.background || "#000000" });
  const raw = (await starter.poster({ width: fmt.width, height: fmt.height })) || [];
  for (const o of raw) if (o) sc.add(o);
  const obj = sc.toObject(SERIALIZE_PROPS);
  sc.dispose();
  return obj;
}

/** Render a scene's composition object to a PNG data URL for the editor stage.
 *  Returns null for an empty (blank) scene. */
export async function renderSceneToDataURL(sceneDoc, width, height, targetW = 960) {
  if (!sceneDoc || typeof sceneDoc !== "object") return null;
  const el = document.createElement("canvas");
  const sc = new StaticCanvas(el, { width, height });
  try {
    await sc.loadFromJSON(sceneDoc);
    sc.renderAll();
    const url = sc.toDataURL({ format: "png", multiplier: Math.min(1, targetW / width) });
    return url;
  } finally {
    sc.dispose();
  }
}

/** A solid background frame for a blank scene (no composition yet). */
export async function renderBlankFrame(width, height, background = "#000000", targetW = 960) {
  const el = document.createElement("canvas");
  const sc = new StaticCanvas(el, { width, height, backgroundColor: background || "#000000" });
  try {
    sc.renderAll();
    return sc.toDataURL({ format: "png", multiplier: Math.min(1, targetW / width) });
  } finally {
    sc.dispose();
  }
}
