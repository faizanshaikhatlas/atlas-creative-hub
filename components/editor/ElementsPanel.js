"use client";

import { useEffect, useRef, useState } from "react";
import { Rect, Circle, Triangle, Line, Polygon, Path } from "fabric";
import {
  Square, Circle as CircleIcon, Triangle as TriangleIcon, Diamond, Pentagon, Hexagon,
  Star, Minus, ArrowRight, MoveHorizontal, ChevronRight, Plus, Heart, Check, MapPin,
  MessageSquare, ImagePlus, Trash2, Search, Loader2,
} from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";
import { saveUpload, listUploads, deleteUpload } from "@/lib/db/projects";

const FILL = "#6366f1";
const STROKE = "#1e1b4b";

function regularPts(n, R, rot = -Math.PI / 2) {
  return Array.from({ length: n }, (_, i) => {
    const a = rot + (i * 2 * Math.PI) / n;
    return { x: R + R * Math.cos(a), y: R + R * Math.sin(a) };
  });
}
function starPts(spikes = 5, outer = 95, inner = 42) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / spikes;
    pts.push({ x: outer + r * Math.cos(a), y: outer + r * Math.sin(a) });
  }
  return pts;
}
const ARROW = [ { x: 0, y: 35 }, { x: 120, y: 35 }, { x: 120, y: 0 }, { x: 200, y: 60 }, { x: 120, y: 120 }, { x: 120, y: 85 }, { x: 0, y: 85 } ];
const DOUBLE = [ { x: 0, y: 60 }, { x: 45, y: 15 }, { x: 45, y: 42 }, { x: 155, y: 42 }, { x: 155, y: 15 }, { x: 200, y: 60 }, { x: 155, y: 105 }, { x: 155, y: 78 }, { x: 45, y: 78 }, { x: 45, y: 105 } ];
const CHEVRON = [ { x: 0, y: 0 }, { x: 45, y: 0 }, { x: 100, y: 80 }, { x: 45, y: 160 }, { x: 0, y: 160 }, { x: 55, y: 80 } ];
const PLUS = [ { x: 60, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 160, y: 60 }, { x: 160, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 160 }, { x: 60, y: 160 }, { x: 60, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 60 }, { x: 60, y: 60 } ];
const HEART = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
const CHECK = "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z";
const PIN = "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z";
const BUBBLE = "M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4v4l5-4h7a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z";

function makePath(d, { fill = FILL, name = "Icon" } = {}) {
  const p = new Path(d, { fill, name });
  const s = 150 / Math.max(p.width || 1, p.height || 1);
  p.scale(s);
  return p;
}

// Each element: an icon for the button + a factory producing an editable Fabric object.
const ELEMENTS = [
  { id: "rect", label: "Rectangle", cat: "Shapes", Icon: Square, make: () => new Rect({ width: 200, height: 130, fill: FILL, name: "Rectangle" }) },
  { id: "rounded", label: "Rounded", cat: "Shapes", Icon: Square, make: () => new Rect({ width: 200, height: 130, rx: 24, ry: 24, fill: FILL, name: "Rounded rectangle" }) },
  { id: "circle", label: "Circle", cat: "Shapes", Icon: CircleIcon, make: () => new Circle({ radius: 90, fill: FILL, name: "Circle" }) },
  { id: "triangle", label: "Triangle", cat: "Shapes", Icon: TriangleIcon, make: () => new Triangle({ width: 180, height: 160, fill: FILL, name: "Triangle" }) },
  { id: "diamond", label: "Diamond", cat: "Shapes", Icon: Diamond, make: () => new Polygon([{ x: 90, y: 0 }, { x: 180, y: 90 }, { x: 90, y: 180 }, { x: 0, y: 90 }], { fill: FILL, name: "Diamond" }) },
  { id: "pentagon", label: "Pentagon", cat: "Shapes", Icon: Pentagon, make: () => new Polygon(regularPts(5, 90), { fill: FILL, name: "Pentagon" }) },
  { id: "hexagon", label: "Hexagon", cat: "Shapes", Icon: Hexagon, make: () => new Polygon(regularPts(6, 90), { fill: FILL, name: "Hexagon" }) },
  { id: "star", label: "Star", cat: "Shapes", Icon: Star, make: () => new Polygon(starPts(), { fill: FILL, name: "Star" }) },
  { id: "line", label: "Line", cat: "Lines & arrows", Icon: Minus, make: () => new Line([0, 0, 220, 0], { stroke: STROKE, strokeWidth: 8, strokeLineCap: "round", name: "Line" }) },
  { id: "arrow", label: "Arrow", cat: "Lines & arrows", Icon: ArrowRight, make: () => new Polygon(ARROW, { fill: FILL, name: "Arrow" }) },
  { id: "double", label: "Double", cat: "Lines & arrows", Icon: MoveHorizontal, make: () => new Polygon(DOUBLE, { fill: FILL, name: "Double arrow" }) },
  { id: "chevron", label: "Chevron", cat: "Lines & arrows", Icon: ChevronRight, make: () => new Polygon(CHEVRON, { fill: FILL, name: "Chevron" }) },
  { id: "plus", label: "Plus", cat: "Icons", Icon: Plus, make: () => new Polygon(PLUS, { fill: FILL, name: "Plus" }) },
  { id: "heart", label: "Heart", cat: "Icons", Icon: Heart, make: () => makePath(HEART, { fill: "#ec4899", name: "Heart" }) },
  { id: "check", label: "Check", cat: "Icons", Icon: Check, make: () => makePath(CHECK, { fill: "#22c55e", name: "Check" }) },
  { id: "pin", label: "Location", cat: "Icons", Icon: MapPin, make: () => makePath(PIN, { fill: FILL, name: "Location pin" }) },
  { id: "bubble", label: "Speech", cat: "Icons", Icon: MessageSquare, make: () => makePath(BUBBLE, { fill: FILL, name: "Speech bubble" }) },
];
const CATEGORIES = ["Shapes", "Lines & arrows", "Icons"];

/** Read a file to a data URL, downscaling very large images for performance/storage. */
async function fileToDataUrl(file, maxDim = 2000) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error("read"));
    r.onload = () => res(String(r.result));
    r.readAsDataURL(file);
  });
  const img = await new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("decode"));
    im.src = dataUrl;
  });
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (Math.max(iw, ih) <= maxDim) return { dataUrl, width: iw, height: ih };
  const scale = maxDim / Math.max(iw, ih);
  const cw = Math.round(iw * scale);
  const ch = Math.round(ih * scale);
  const cv = document.createElement("canvas");
  cv.width = cw;
  cv.height = ch;
  cv.getContext("2d").drawImage(img, 0, 0, cw, ch);
  return { dataUrl: cv.toDataURL("image/jpeg", 0.85), width: cw, height: ch };
}

export default function ElementsPanel({ controllerRef }) {
  const fileInputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState([]);
  const setMobilePanel = useEditorStore((s) => s.setMobilePanel);

  async function refresh() {
    try { setUploads(await listUploads()); } catch { setUploads([]); }
  }
  useEffect(() => { refresh(); }, []);

  const addEl = (el) => {
    const c = controllerRef.current;
    if (!c) return;
    c.addObject(el.make(), el.label);
    setMobilePanel(null);
  };

  const insertUpload = (up) => {
    const c = controllerRef.current;
    if (!c) return;
    c.addImageFromUrl(up.dataUrl).catch(() => setError("Could not add that image."));
    setMobilePanel(null);
  };

  async function removeUpload(e, id) {
    e.stopPropagation();
    try { await deleteUpload(id); await refresh(); } catch { /* ignore */ }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG, WebP, GIF).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("That image is too large (max 15 MB).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { dataUrl, width, height } = await fileToDataUrl(file);
      const c = controllerRef.current;
      if (c) await c.addImageFromUrl(dataUrl);
      try {
        await saveUpload({ name: file.name, dataUrl, width, height, bytes: dataUrl.length });
        await refresh();
      } catch {
        setError("Added to the canvas, but it could not be saved to your uploads (storage limit?).");
      }
      setMobilePanel(null);
    } catch (err) {
      setError(err?.message === "decode" ? "That image could not be read." : "Could not add that image.");
    } finally {
      setBusy(false);
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = q ? ELEMENTS.filter((el) => el.label.toLowerCase().includes(q) || el.cat.toLowerCase().includes(q)) : ELEMENTS;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search elements…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-2 text-sm outline-none focus:border-brand-400"
        />
      </div>

      {/* Elements by category */}
      {CATEGORIES.map((cat) => {
        const items = filtered.filter((el) => el.cat === cat);
        if (!items.length) return null;
        return (
          <div key={cat}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{cat}</h2>
            <div className="grid grid-cols-3 gap-2">
              {items.map((el) => (
                <button
                  key={el.id}
                  type="button"
                  onClick={() => addEl(el)}
                  title={el.label}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-slate-600 transition hover:border-brand-500 hover:text-brand-700 hover:shadow-sm"
                >
                  <el.Icon size={20} />
                  <span className="text-[10px] font-medium leading-none">{el.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {q && filtered.length === 0 && (
        <p className="text-xs text-slate-400">No elements match “{query}”.</p>
      )}

      {/* Uploads library */}
      <div className="border-t border-slate-100 pt-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Your uploads</h2>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-500 transition hover:border-brand-500 hover:text-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 size={22} className="animate-spin" /> : <ImagePlus size={22} />}
          <span className="text-xs font-medium">{busy ? "Adding…" : "Upload from device"}</span>
          <span className="text-[11px] text-slate-400">PNG, JPG, WebP, GIF · saved for reuse</span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        {error && <p className="mt-2 text-xs text-rose-600" role="alert">{error}</p>}

        {uploads.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {uploads.map((up) => (
              <button
                key={up.id}
                type="button"
                onClick={() => insertUpload(up)}
                title={`Add ${up.name}`}
                className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-brand-400"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={up.dataUrl} alt={up.name} className="h-full w-full object-cover" />
                <span
                  role="button"
                  aria-label="Delete upload"
                  onClick={(e) => removeUpload(e, up.id)}
                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded bg-white/90 text-slate-400 opacity-0 shadow-sm transition hover:text-rose-600 group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
