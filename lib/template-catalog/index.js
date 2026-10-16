"use client";

import { StaticCanvas } from "fabric";
import { FORMATS, THEMES, THEME_BY_ID, SERIALIZE_PROPS } from "@/lib/template-catalog/formats";
import { TEMPLATES } from "@/lib/template-catalog/catalog";
import { FONTS, primaryFamily } from "@/lib/fonts";
import { createProject, saveProject } from "@/lib/db/projects";

export { FORMATS, THEMES, THEME_BY_ID, TEMPLATES };

/** Build a StaticCanvas for a template at its native size (browser only). */
function buildStaticCanvas(template) {
  const fmt = FORMATS[template.format] || FORMATS["ig-post"];
  const el = document.createElement("canvas");
  const sc = new StaticCanvas(el, {
    width: fmt.width,
    height: fmt.height,
    backgroundColor: template.background || "#ffffff",
  });
  const objects = template.build({ width: fmt.width, height: fmt.height }) || [];
  objects.forEach((o) => sc.add(o));
  return { sc, fmt };
}

/** Serialize a template to a page `json` string (same shape as canvas.toJSON). */
export function buildTemplatePageJSON(template) {
  const { sc } = buildStaticCanvas(template);
  const json = JSON.stringify(sc.toObject(SERIALIZE_PROPS));
  sc.dispose();
  return json;
}

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

const _thumbCache = new Map(); // key: `${id}@${w}` -> dataURL
/** Render a template to a PNG data URL (cached). */
export async function renderTemplateThumbnail(template, targetW = 480) {
  const key = `${template.id}@${targetW}`;
  if (_thumbCache.has(key)) return _thumbCache.get(key);
  await ensureFonts();
  const { sc, fmt } = buildStaticCanvas(template);
  sc.renderAll();
  const url = sc.toDataURL({ format: "png", multiplier: targetW / fmt.width });
  sc.dispose();
  _thumbCache.set(key, url);
  return url;
}

/**
 * Create a NEW, independent Dexie project seeded from a template. Editing it
 * never touches the template (templates are code) or any other copy.
 * @returns the new project id.
 */
export async function createDesignFromTemplate(template) {
  const fmt = FORMATS[template.format] || FORMATS["ig-post"];
  const json = buildTemplatePageJSON(template);
  // Pass the real format projectType ('custom' for poster); createProject keeps
  // the exact width/height we provide and falls back to a preset only for sizing.
  const project = await createProject({ name: template.title, type: fmt.projectType, width: fmt.width, height: fmt.height });
  const page0 = project.pages[0];
  await saveProject(project.id, {
    pages: [{ ...page0, json, background: template.background || "#ffffff" }],
    activePageId: page0.id,
  });
  return project.id;
}

/** Simple search + filter over the catalog. */
export function filterTemplates({ query = "", theme = "all", format = "all" } = {}) {
  const q = query.trim().toLowerCase();
  return TEMPLATES.filter((t) => {
    if (theme !== "all" && t.theme !== theme) return false;
    if (format !== "all" && t.format !== format) return false;
    if (!q) return true;
    const hay = `${t.title} ${t.theme} ${(t.keywords || []).join(" ")} ${FORMATS[t.format]?.label || ""}`.toLowerCase();
    return hay.includes(q);
  });
}
