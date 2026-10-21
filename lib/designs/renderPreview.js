"use client";

import { StaticCanvas } from "fabric";
import { FONTS, primaryFamily } from "@/lib/fonts";

/**
 * Render a saved design page to a PNG data URL, headlessly, from the design
 * document itself — the same single source of truth the editor and templates
 * use. No separate thumbnail store: the preview is derived from `page.json`
 * (the serialized Fabric canvas), with images already resolved to signed URLs
 * by the load path. Browser-only (Fabric needs a DOM/canvas).
 */

let _fontsReady = null;
async function ensureFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  if (!_fontsReady) {
    _fontsReady = Promise.all(
      FONTS.flatMap((f) => {
        const fam = primaryFamily(f.css);
        return [
          document.fonts.load(`400 40px ${fam}`).catch(() => {}),
          document.fonts.load(`700 40px ${fam}`).catch(() => {}),
        ];
      })
    );
  }
  await _fontsReady;
}

/**
 * @param {{ json: string|object|null, width:number, height:number, background?:string }} page
 * @returns {Promise<string|null>} data URL, or null when there's nothing to render.
 */
export async function renderDesignPreview(page, targetW = 520) {
  if (typeof document === "undefined" || !page || !page.json) return null;
  const w = page.width || 1080;
  const h = page.height || 1080;
  await ensureFonts();

  const el = document.createElement("canvas");
  const sc = new StaticCanvas(el, { width: w, height: h, backgroundColor: page.background || "#ffffff" });
  try {
    const json = typeof page.json === "string" ? page.json : JSON.stringify(page.json);
    await sc.loadFromJSON(json); // async — loads referenced images too
    sc.renderAll();
    return sc.toDataURL({ format: "png", multiplier: Math.min(1, targetW / w) });
  } finally {
    try { sc.dispose(); } catch { /* ignore */ }
  }
}
