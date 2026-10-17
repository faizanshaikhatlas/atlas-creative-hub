"use client";

import { StaticCanvas } from "fabric";
import { FORMATS, THEMES, THEME_BY_ID, SERIALIZE_PROPS } from "@/lib/template-catalog/formats";
import { TEMPLATES } from "@/lib/template-catalog/catalog";
import { photo } from "@/lib/template-catalog/helpers";
import { FONTS, primaryFamily } from "@/lib/fonts";
import { createProject, saveProject } from "@/lib/db/projects";

export { FORMATS, THEMES, THEME_BY_ID, TEMPLATES };

/** Build a StaticCanvas for a template at its native size (browser only).
 * `build()` may be async (templates that load real photos await them). */
async function buildStaticCanvas(template) {
  const fmt = FORMATS[template.format] || FORMATS["ig-post"];
  const el = document.createElement("canvas");
  const sc = new StaticCanvas(el, {
    width: fmt.width,
    height: fmt.height,
    backgroundColor: template.background || "#ffffff",
  });
  const raw = (await template.build({ width: fmt.width, height: fmt.height })) || [];
  // Resolve any photo markers into real, loaded, editable Fabric images.
  for (const o of raw) {
    if (o && o.__photo) {
      try {
        sc.add(await photo(o.__photo.src, o.__photo));
      } catch {
        /* photo failed to load — skip it; the rest of the design still renders */
      }
    } else if (o) {
      sc.add(o);
    }
  }
  return { sc, fmt };
}

/** Serialize a template to a page `json` string (same shape as canvas.toJSON).
 * Photo layers serialize with their src and reload when the design is reopened. */
export async function buildTemplatePageJSON(template) {
  const { sc } = await buildStaticCanvas(template);
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
  const { sc, fmt } = await buildStaticCanvas(template);
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
  const json = await buildTemplatePageJSON(template);
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

/** A curated, visually strong selection spanning several themes. */
export const FEATURED_IDS = [
  "lux-product-reveal", "yt-i-did-this", "food-restaurant", "tech-ai-launch",
  "nat-wellness", "corp-title-slide", "cre-gradient-abstract", "soc-new-post",
];
export function getFeatured() {
  return FEATURED_IDS.map((id) => TEMPLATES.find((t) => t.id === id)).filter(Boolean);
}

/** Templates for one theme, optionally capped (for the section rows). */
export function templatesByTheme(themeId, limit) {
  const list = TEMPLATES.filter((t) => t.theme === themeId);
  return typeof limit === "number" ? list.slice(0, limit) : list;
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
