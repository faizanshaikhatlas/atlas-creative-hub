"use client";

import { useEditorStore } from "@/lib/store/editorStore";

// Changing the page background only sets canvas.backgroundColor — existing
// objects are untouched. The value serializes with the page JSON, so it is
// per-page and carries through PNG/JPG/SVG/PDF exports.

const SOLIDS = [
  "#ffffff", "#000000", "#0f172a", "#1e293b", "#f8fafc", "#e2e8f0",
  "#6366f1", "#7c3aed", "#ec4899", "#ef4444", "#f59e0b", "#fde047",
  "#22c55e", "#10b981", "#06b6d4", "#3b82f6",
];

const GRADIENTS = [
  { colors: ["#6366f1", "#ec4899"], angle: 90 },
  { colors: ["#22d3ee", "#7c3aed"], angle: 120 },
  { colors: ["#f59e0b", "#ef4444"], angle: 90 },
  { colors: ["#10b981", "#06b6d4"], angle: 135 },
  { colors: ["#fde047", "#f97316"], angle: 90 },
  { colors: ["#111827", "#4f46e5"], angle: 160 },
  { colors: ["#ff6b9d", "#feca57"], angle: 120 },
  { colors: ["#0f3d6e", "#2563eb"], angle: 90 },
];

export default function BackgroundsPanel({ controllerRef }) {
  const pageBackground = useEditorStore((s) => s.pageBackground);
  const c = () => controllerRef.current;

  return (
    <div className="ds-scroll flex h-full flex-col gap-5 overflow-y-auto p-4">
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Solid colors</h2>
        <div className="grid grid-cols-6 gap-2">
          {SOLIDS.map((hex) => (
            <button
              key={hex}
              type="button"
              title={hex}
              onClick={() => c()?.setPageBackground(hex)}
              className="aspect-square rounded-lg border border-slate-200 shadow-sm transition hover:scale-105 hover:border-brand-400"
              style={{ background: hex }}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Gradients</h2>
        <div className="grid grid-cols-4 gap-2">
          {GRADIENTS.map((g, i) => (
            <button
              key={i}
              type="button"
              title="Apply gradient"
              onClick={() => c()?.setPageBackgroundGradient({ type: "linear", colors: g.colors, angle: g.angle })}
              className="aspect-square rounded-lg border border-slate-200 shadow-sm transition hover:scale-105 hover:border-brand-400"
              style={{ background: `linear-gradient(135deg, ${g.colors[0]}, ${g.colors[1]})` }}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Custom color</h2>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={typeof pageBackground === "string" ? pageBackground : "#ffffff"}
            onChange={(e) => c()?.setPageBackground(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border border-slate-200 bg-white p-0.5"
            aria-label="Custom background color"
          />
          <input
            type="text"
            value={typeof pageBackground === "string" ? pageBackground : ""}
            placeholder="#rrggbb or gradient preset"
            onChange={(e) => c()?.setPageBackground(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
          />
        </div>
      </div>

      <p className="mt-auto rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-400">
        Background changes affect the current page only and keep all your objects in place.
      </p>
    </div>
  );
}
