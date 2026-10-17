"use client";

import { useState } from "react";
import { BarChart3, Plus, Trash2 } from "lucide-react";

// Charts are inserted as editable Fabric groups (bars/lines/slices + labels),
// so they move, scale, export, and persist like any other element.

const TYPES = [
  { id: "column", label: "Column" },
  { id: "bar", label: "Bar" },
  { id: "line", label: "Line" },
  { id: "pie", label: "Pie" },
  { id: "donut", label: "Donut" },
];

const DEFAULT_ROWS = [
  { label: "Q1", value: 42 },
  { label: "Q2", value: 68 },
  { label: "Q3", value: 55 },
  { label: "Q4", value: 90 },
];

export default function ChartsPanel({ controllerRef }) {
  const [type, setType] = useState("column");
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const c = () => controllerRef.current;

  const setRow = (i, patch) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const addRow = () => setRows((r) => (r.length >= 12 ? r : [...r, { label: `Item ${r.length + 1}`, value: 10 }]));
  const removeRow = (i) => setRows((r) => (r.length <= 1 ? r : r.filter((_, idx) => idx !== i)));

  function insert() {
    const data = rows
      .map((r) => ({ label: r.label, value: Number(r.value) || 0 }))
      .filter((r) => r.label !== "" || r.value !== 0);
    if (!data.length) return;
    c()?.addChart({ type, title: title.trim(), data });
  }

  return (
    <div className="ds-scroll flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Chart type</h2>
        <div className="grid grid-cols-3 gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={`rounded-md border py-1.5 text-xs font-medium transition ${
                type === t.id
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Title (optional)</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Chart title"
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Data</h2>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            <Plus size={13} /> Row
          </button>
        </div>
        <div className="space-y-1.5">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={row.label}
                onChange={(e) => setRow(i, { label: e.target.value })}
                placeholder="Label"
                className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
              />
              <input
                type="number"
                value={row.value}
                onChange={(e) => setRow(i, { value: e.target.value })}
                className="w-20 rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
                aria-label="Value"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={rows.length <= 1}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                aria-label="Remove row"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={insert}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        <BarChart3 size={16} /> Insert chart
      </button>

      <p className="mt-auto rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-400">
        The chart is added as an editable group — move, resize, recolor, or
        ungroup it like any element. Re-insert to change the data.
      </p>
    </div>
  );
}
