"use client";

import { StaticCanvas } from "fabric";
import { VIDEO_FORMATS } from "@/lib/video/formats";
import { FONTS, primaryFamily } from "@/lib/fonts";

// Renders a video starter's OPENING FRAME (its editable poster) to a PNG data URL
// using the same Fabric StaticCanvas approach as the static template previews.
// This is a genuine render of the editable first frame — not a fake screenshot.

let _fontsReady = null;
async function ensureFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  if (!_fontsReady) {
    _fontsReady = Promise.all(
      FONTS.flatMap((f) => {
        const fam = primaryFamily(f.css);
        return [document.fonts.load(`400 40px ${fam}`).catch(() => {}), document.fonts.load(`700 40px ${fam}`).catch(() => {})];
      })
    );
  }
  await _fontsReady;
}

const _cache = new Map(); // `${id}@${w}` -> dataURL

export async function renderVideoPoster(starter, targetW = 520) {
  const key = `${starter.id}@${targetW}`;
  if (_cache.has(key)) return _cache.get(key);
  await ensureFonts();
  const fmt = VIDEO_FORMATS[starter.format] || VIDEO_FORMATS["yt-video"];
  const el = document.createElement("canvas");
  const sc = new StaticCanvas(el, { width: fmt.width, height: fmt.height, backgroundColor: starter.background || "#0b1020" });
  const raw = (await starter.poster({ width: fmt.width, height: fmt.height })) || [];
  for (const o of raw) if (o) sc.add(o);
  sc.renderAll();
  const url = sc.toDataURL({ format: "png", multiplier: targetW / fmt.width });
  sc.dispose();
  _cache.set(key, url);
  return url;
}
