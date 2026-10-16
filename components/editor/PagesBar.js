"use client";

import { useState } from "react";
import { Plus, Copy, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Horizontal page filmstrip shown at the bottom of the editor. Purely
 * presentational — all page operations are handled by the Editor via the
 * callbacks passed in.
 */
export default function PagesBar({
  pages,
  activePageId,
  onSwitch,
  onAdd,
  onDuplicate,
  onDelete,
  onReorder,
  onRename,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");

  function startRename(page) {
    setEditingId(page.id);
    setDraft(page.name);
  }
  function commitRename() {
    if (editingId && draft.trim()) onRename(editingId, draft.trim());
    setEditingId(null);
  }

  return (
    <div className="flex h-24 shrink-0 items-stretch gap-2 border-t border-slate-200 bg-white px-3 py-2">
      <div className="ds-scroll flex min-w-0 flex-1 items-stretch gap-2 overflow-x-auto">
        {pages.map((page, idx) => {
          const active = page.id === activePageId;
          return (
            <div
              key={page.id}
              className={`group relative flex w-28 shrink-0 flex-col overflow-hidden rounded-lg border-2 transition ${
                active
                  ? "border-brand-500 ring-2 ring-brand-200"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <button
                type="button"
                onClick={() => onSwitch(page.id)}
                className="relative flex-1 bg-slate-50"
                aria-label={`Go to ${page.name}`}
              >
                {page.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={page.thumbnail}
                    alt={page.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[10px] text-slate-300">
                    Empty
                  </span>
                )}
                <span className="absolute left-1 top-1 rounded bg-black/50 px-1 text-[10px] font-medium text-white">
                  {idx + 1}
                </span>
              </button>

              {/* Hover actions */}
              <div className="pointer-events-none absolute right-1 top-1 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                <span
                  role="button"
                  aria-label="Move page left"
                  onClick={() => onReorder(page.id, "left")}
                  className={`pointer-events-auto inline-flex h-5 w-5 items-center justify-center rounded bg-white/90 text-slate-500 shadow-sm hover:text-slate-800 ${
                    idx === 0 ? "pointer-events-none opacity-30" : ""
                  }`}
                >
                  <ChevronLeft size={12} />
                </span>
                <span
                  role="button"
                  aria-label="Move page right"
                  onClick={() => onReorder(page.id, "right")}
                  className={`pointer-events-auto inline-flex h-5 w-5 items-center justify-center rounded bg-white/90 text-slate-500 shadow-sm hover:text-slate-800 ${
                    idx === pages.length - 1 ? "pointer-events-none opacity-30" : ""
                  }`}
                >
                  <ChevronRight size={12} />
                </span>
                <span
                  role="button"
                  aria-label="Duplicate page"
                  onClick={() => onDuplicate(page.id)}
                  className="pointer-events-auto inline-flex h-5 w-5 items-center justify-center rounded bg-white/90 text-slate-500 shadow-sm hover:text-slate-800"
                >
                  <Copy size={12} />
                </span>
                {pages.length > 1 && (
                  <span
                    role="button"
                    aria-label="Delete page"
                    onClick={() => onDelete(page.id)}
                    className="pointer-events-auto inline-flex h-5 w-5 items-center justify-center rounded bg-white/90 text-rose-500 shadow-sm hover:text-rose-700"
                  >
                    <Trash2 size={12} />
                  </span>
                )}
              </div>

              {/* Name / rename */}
              {editingId === page.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="border-t border-slate-200 px-1 py-0.5 text-center text-[11px] outline-none"
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={() => startRename(page)}
                  onClick={() => onSwitch(page.id)}
                  className={`truncate border-t border-slate-200 px-1 py-0.5 text-center text-[11px] ${
                    active ? "font-semibold text-brand-700" : "text-slate-500"
                  }`}
                  title={`${page.name} (double-click to rename)`}
                >
                  {page.name}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-brand-400 hover:text-brand-600"
        aria-label="Add page"
      >
        <Plus size={20} />
        <span className="text-[10px] font-medium">Add</span>
      </button>
    </div>
  );
}
