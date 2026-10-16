"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { SIZE_PRESETS, clampDim, MIN_DIM, MAX_DIM } from "@/lib/db/projects";

const GROUPS = ["YouTube", "Social", "Other"];

// A small aspect-ratio preview so each size reads at a glance.
function Ratio({ width, height }) {
  const landscape = width >= height;
  const w = landscape ? 44 : (44 * width) / height;
  const h = landscape ? (44 * height) / width : 44;
  return (
    <div className="flex h-12 items-center justify-center">
      <div
        className="rounded-sm bg-brand-100 ring-1 ring-brand-300"
        style={{ width: Math.max(10, w), height: Math.max(10, h) }}
      />
    </div>
  );
}

export default function NewDesignDialog({ open, onClose, onCreate }) {
  const [cw, setCw] = useState(1280);
  const [ch, setCh] = useState(720);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">New design</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="ds-scroll flex-1 overflow-y-auto p-5">
          {GROUPS.map((group) => (
            <div key={group} className="mb-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {group}
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {SIZE_PRESETS.filter((p) => p.group === group).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      onCreate({ type: p.id, width: p.width, height: p.height })
                    }
                    className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-center transition hover:border-brand-500 hover:shadow-sm"
                  >
                    <Ratio width={p.width} height={p.height} />
                    <span className="text-sm font-medium text-slate-700">
                      {p.label}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {p.width} × {p.height}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Custom size
            </h3>
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 p-3">
              <label className="text-xs text-slate-500">
                Width
                <input
                  type="number"
                  min={MIN_DIM}
                  max={MAX_DIM}
                  value={cw}
                  onChange={(e) => setCw(Number(e.target.value) || 0)}
                  className="mt-1 block w-24 rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
                />
              </label>
              <span className="pb-2 text-slate-400">×</span>
              <label className="text-xs text-slate-500">
                Height
                <input
                  type="number"
                  min={MIN_DIM}
                  max={MAX_DIM}
                  value={ch}
                  onChange={(e) => setCh(Number(e.target.value) || 0)}
                  className="mt-1 block w-24 rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  onCreate({
                    type: "custom",
                    width: clampDim(cw, 1280),
                    height: clampDim(ch, 720),
                  })
                }
                className="ml-auto rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Create
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {MIN_DIM}–{MAX_DIM}px per side.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
