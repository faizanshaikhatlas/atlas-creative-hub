"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ImagePlus, Loader2, X } from "lucide-react";
import { FONTS } from "@/lib/fonts";
import { useEditorStore } from "@/lib/store/editorStore";
import { saveBrandKit, listBrandKits, deleteBrandKit } from "@/lib/db/projects";

// Built-in default kit — keeps ATLAS branding as the default brand kit.
const ATLAS_KIT = {
  id: "atlas-default",
  name: "ATLAS (default)",
  builtin: true,
  colors: ["#342B7C", "#6366f1", "#ec4899", "#f59e0b", "#0f172a", "#ffffff"],
  headingFont: "Poppins",
  bodyFont: "Inter",
  logos: ["/brand/atlas-symbol.svg", "/brand/atlas-logo.svg"],
};

const fontCss = (label) => FONTS.find((f) => f.label === label)?.css || null;

async function readLogo(file, maxDim = 1200) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error("read"));
    r.onload = () => res(String(r.result));
    r.readAsDataURL(file);
  });
  if (file.type === "image/svg+xml") return dataUrl; // keep vector logos as-is
  const img = await new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("decode"));
    im.src = dataUrl;
  });
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (Math.max(iw, ih) <= maxDim) return dataUrl;
  const s = maxDim / Math.max(iw, ih);
  const cv = document.createElement("canvas");
  cv.width = Math.round(iw * s);
  cv.height = Math.round(ih * s);
  cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL("image/png");
}

export default function BrandKitPanel({ controllerRef }) {
  const selection = useEditorStore((s) => s.selection);
  const c = () => controllerRef.current;
  const [kits, setKits] = useState([ATLAS_KIT]);
  const [activeId, setActiveId] = useState("atlas-default");
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    try {
      const user = await listBrandKits();
      setKits([ATLAS_KIT, ...user]);
    } catch {
      setKits([ATLAS_KIT]);
    }
  }
  useEffect(() => { refresh(); }, []);

  const kit = kits.find((k) => k.id === activeId) || ATLAS_KIT;

  function applyColor(hex) {
    const ctrl = c();
    if (!ctrl) return;
    if (selection) ctrl.setSolidFill(hex);
    else ctrl.setPageBackground(hex);
  }
  function applyFont(label) {
    const css = fontCss(label);
    if (css) c()?.setActiveFont(css);
  }
  function addLogo(url) {
    c()?.addImageFromUrl(url).catch(() => {});
  }

  async function removeKit(e, id) {
    e.stopPropagation();
    try {
      await deleteBrandKit(id);
      if (activeId === id) setActiveId("atlas-default");
      await refresh();
    } catch { /* ignore */ }
  }

  return (
    <div className="ds-scroll flex h-full flex-col gap-5 overflow-y-auto p-4">
      {/* Kit selector */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Brand kit</h2>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
          >
            {showForm ? <X size={13} /> : <Plus size={13} />} {showForm ? "Cancel" : "New"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {kits.map((k) => (
            <span key={k.id} className="relative">
              <button
                type="button"
                onClick={() => setActiveId(k.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activeId === k.id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {k.name}
              </button>
              {!k.builtin && (
                <span
                  role="button"
                  aria-label="Delete kit"
                  onClick={(e) => removeKit(e, k.id)}
                  className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-slate-400 shadow hover:text-rose-600"
                >
                  <Trash2 size={10} />
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {showForm && <NewKitForm onSaved={async (id) => { setShowForm(false); await refresh(); setActiveId(id); }} />}

      {/* Colors */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Colors</h3>
        <div className="grid grid-cols-6 gap-2">
          {kit.colors.map((hex, i) => (
            <button
              key={i}
              type="button"
              title={`${hex} — ${selection ? "apply to selection" : "set as background"}`}
              onClick={() => applyColor(hex)}
              className="aspect-square rounded-lg border border-slate-200 shadow-sm transition hover:scale-105 hover:border-brand-400"
              style={{ background: hex }}
            />
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">
          {selection ? "Click to fill the selected object." : "Click to set the page background."}
        </p>
      </div>

      {/* Fonts */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Fonts</h3>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => applyFont(kit.headingFont)}
            disabled={!selection?.isText}
            style={{ fontFamily: fontCss(kit.headingFont) || undefined }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-lg font-bold text-slate-800 transition hover:border-brand-500 disabled:opacity-50"
          >
            {kit.headingFont || "Heading"} <span className="text-xs font-normal text-slate-400">· Heading</span>
          </button>
          <button
            type="button"
            onClick={() => applyFont(kit.bodyFont)}
            disabled={!selection?.isText}
            style={{ fontFamily: fontCss(kit.bodyFont) || undefined }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-brand-500 disabled:opacity-50"
          >
            {kit.bodyFont || "Body"} <span className="text-xs text-slate-400">· Body</span>
          </button>
        </div>
        {!selection?.isText && <p className="mt-1.5 text-[11px] text-slate-400">Select a text object to apply a font.</p>}
      </div>

      {/* Logos */}
      {kit.logos?.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Logos</h3>
          <div className="grid grid-cols-3 gap-2">
            {kit.logos.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => addLogo(url)}
                title="Add logo to canvas"
                className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2 transition hover:border-brand-400"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Logo" className="max-h-full max-w-full object-contain" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NewKitForm({ onSaved }) {
  const [name, setName] = useState("");
  const [colors, setColors] = useState(["#342B7C", "#6366f1", "#ec4899"]);
  const [headingFont, setHeadingFont] = useState(FONTS[2].label); // Poppins
  const [bodyFont, setBodyFont] = useState(FONTS[0].label); // Inter
  const [logo, setLogo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type?.startsWith("image/")) { setError("Logo must be an image."); return; }
    try { setLogo(await readLogo(file)); setError(null); }
    catch { setError("Could not read that logo."); }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const kit = await saveBrandKit({
        name: name.trim() || "My brand kit",
        colors: colors.filter(Boolean),
        headingFont,
        bodyFont,
        logos: logo ? [logo] : [],
      });
      onSaved?.(kit.id);
    } catch (err) {
      // Surface the real Dexie/IndexedDB exception instead of a generic message.
      console.error("Brand kit save failed:", err);
      const detail = err?.name && err?.message ? `${err.name}: ${err.message}` : String(err?.message || err?.name || err);
      setError(`Could not save the brand kit — ${detail}`);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Kit name"
        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500"
      />
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Colors</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {colors.map((hex, i) => (
            <input
              key={i}
              type="color"
              value={hex}
              onChange={(e) => setColors(colors.map((c2, j) => (j === i ? e.target.value : c2)))}
              className="h-8 w-8 cursor-pointer rounded-md border border-slate-200 bg-white p-0.5"
            />
          ))}
          {colors.length < 8 && (
            <button type="button" onClick={() => setColors([...colors, "#000000"])}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-400 hover:text-brand-600">
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-slate-500">
          Heading
          <select value={headingFont} onChange={(e) => setHeadingFont(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-1.5 py-1 text-xs outline-none focus:border-brand-500">
            {FONTS.map((f) => <option key={f.label} value={f.label}>{f.label}</option>)}
          </select>
        </label>
        <label className="text-[11px] text-slate-500">
          Body
          <select value={bodyFont} onChange={(e) => setBodyFont(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-1.5 py-1 text-xs outline-none focus:border-brand-500">
            {FONTS.map((f) => <option key={f.label} value={f.label}>{f.label}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-400">
          <ImagePlus size={14} /> {logo ? "Logo added" : "Add logo"}
          <input type="file" accept="image/*" onChange={handleLogo} className="hidden" />
        </label>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="Logo preview" className="h-8 w-8 rounded border border-slate-200 object-contain" />
        )}
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : null} Save brand kit
      </button>
    </div>
  );
}
