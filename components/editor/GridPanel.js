"use client";

import { useState } from "react";
import { LayoutGrid, Loader2 } from "lucide-react";

// Photo grids insert a collage of placeholder image frames. Each frame is an
// ordinary image, so it is filled via Properties → Replace image and keeps all
// the existing crop / mask / filter tools.

const LAYOUTS = [
  { rows: 1, cols: 2 },
  { rows: 2, cols: 1 },
  { rows: 2, cols: 2 },
  { rows: 1, cols: 3 },
  { rows: 3, cols: 1 },
  { rows: 2, cols: 3 },
  { rows: 3, cols: 2 },
  { rows: 3, cols: 3 },
];

function Thumb({ rows, cols, active }) {
  return (
    <div
      className={`grid gap-0.5 rounded ${active ? "" : ""}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, width: 40, height: 40 }}
    >
      {Array.from({ length: rows * cols }).map((_, i) => (
        <span key={i} className={`rounded-[2px] ${active ? "bg-brand-500" : "bg-slate-300"}`} />
      ))}
    </div>
  );
}

export default function GridPanel({ controllerRef }) {
  const [sel, setSel] = useState(2); // index into LAYOUTS (2 = 2×2)
  const [gap, setGap] = useState(12);
  const [rounded, setRounded] = useState(true);
  const [busy, setBusy] = useState(false);
  const c = () => controllerRef.current;

  async function insert() {
    const layout = LAYOUTS[sel];
    setBusy(true);
    try {
      await c()?.addPhotoGrid({ rows: layout.rows, cols: layout.cols, gap, rounded });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ds-scroll flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Layout</h2>
        <div className="grid grid-cols-4 gap-2">
          {LAYOUTS.map((l, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSel(i)}
              title={`${l.rows} × ${l.cols}`}
              className={`flex items-center justify-center rounded-lg border p-2 transition ${
                sel === i ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <Thumb rows={l.rows} cols={l.cols} active={sel === i} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[11px] text-slate-500">
          <span className="font-semibold uppercase tracking-wide text-slate-400">Gap</span>
          <span className="tabular-nums">{gap}px</span>
        </div>
        <input type="range" min={0} max={48} value={gap} onChange={(e) => setGap(Number(e.target.value))} className="w-full accent-brand-600" />
      </div>

      <label className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
        <span className="text-sm text-slate-600">Rounded corners</span>
        <input type="checkbox" checked={rounded} onChange={(e) => setRounded(e.target.checked)} className="h-4 w-4 accent-brand-600" />
      </label>

      <button
        type="button"
        onClick={insert}
        disabled={busy}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <LayoutGrid size={16} />} Insert grid
      </button>

      <p className="mt-auto rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-400">
        Each cell is a photo frame. Select a cell and use Properties → Replace to
        drop in a photo from your device or uploads; it fills the frame and keeps
        crop, mask, and filter controls.
      </p>
    </div>
  );
}
