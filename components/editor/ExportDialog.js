"use client";

import { useState } from "react";
import { X, Download, Loader2 } from "lucide-react";

const FORMATS = [
  { id: "png", label: "PNG", hint: "Best for graphics · transparency" },
  { id: "jpg", label: "JPG", hint: "Smaller file · photos" },
  { id: "svg", label: "SVG", hint: "Vector · current page" },
  { id: "pdf", label: "PDF", hint: "All pages · print" },
];
const SCALES = [1, 2, 3];

export default function ExportDialog({ pageCount = 1, pageSize = { width: 0, height: 0 }, onClose, onExport }) {
  const [format, setFormat] = useState("png");
  const [scale, setScale] = useState(1);
  const [transparent, setTransparent] = useState(false);
  const [pages, setPages] = useState("current");
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isRaster = format === "png" || format === "jpg";
  const effectivePages = format === "pdf" ? "all" : format === "svg" ? "current" : pages;
  const outW = Math.round(pageSize.width * scale);
  const outH = Math.round(pageSize.height * scale);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await onExport({
        format,
        scale: isRaster || format === "pdf" ? scale : 1,
        transparent: format === "png" && transparent,
        pages: effectivePages,
        quality: quality / 100,
      });
      onClose();
    } catch (err) {
      console.error("Export failed:", err);
      setError(err?.message ? `Export failed — ${err.message}` : "Export failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h2 className="text-sm font-semibold text-slate-800">Export design</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="space-y-4 p-4">
          {/* Format */}
          <div className="grid grid-cols-2 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id)}
                className={`rounded-xl border p-3 text-left transition ${
                  format === f.id ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="text-sm font-semibold text-slate-800">{f.label}</div>
                <div className="text-[11px] text-slate-400">{f.hint}</div>
              </button>
            ))}
          </div>

          {/* Scale (raster + pdf) */}
          {(isRaster || format === "pdf") && (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Size</label>
              <div className="flex gap-1.5">
                {SCALES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScale(s)}
                    className={`flex-1 rounded-md border py-1.5 text-xs font-medium transition ${
                      scale === s ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
              {isRaster && pageSize.width > 0 && (
                <p className="mt-1.5 text-[11px] text-slate-400">Output: {outW} × {outH} px</p>
              )}
            </div>
          )}

          {/* Pages (raster, multi-page) */}
          {isRaster && pageCount > 1 && (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pages</label>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setPages("current")}
                  className={`flex-1 rounded-md border py-1.5 text-xs font-medium transition ${pages === "current" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  Current page
                </button>
                <button type="button" onClick={() => setPages("all")}
                  className={`flex-1 rounded-md border py-1.5 text-xs font-medium transition ${pages === "all" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  All {pageCount} pages
                </button>
              </div>
              {pages === "all" && <p className="mt-1.5 text-[11px] text-slate-400">Downloads one file per page.</p>}
            </div>
          )}

          {/* Transparent (PNG) */}
          {format === "png" && (
            <label className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
              <span className="text-sm text-slate-600">Transparent background</span>
              <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            </label>
          )}

          {/* Quality (JPG) */}
          {format === "jpg" && (
            <div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span className="font-semibold uppercase tracking-wide text-slate-400">Quality</span>
                <span className="tabular-nums">{quality}%</span>
              </div>
              <input type="range" min={40} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-brand-600" />
            </div>
          )}

          {format === "svg" && <p className="text-[11px] text-slate-400">SVG exports the current page as scalable vector artwork.</p>}

          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">Cancel</button>
          <button onClick={run} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {busy ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
