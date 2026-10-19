"use client";

import { useState } from "react";
import { BarChart3, Plus, Trash2 } from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";

// Charts are inserted as editable Fabric groups (bars/lines/slices + labels),
// so they move, scale, export, and persist like any other element. Selecting a
// chart re-opens its stored spec here for live editing (type / title / data).

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

const clone = (s) => JSON.parse(JSON.stringify(s));

// Mirror of the controller's default categorical palette (for showing defaults).
const PALETTE = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#06b6d4",
  "#8b5cf6", "#ef4444", "#3b82f6", "#14b8a6", "#f97316",
];

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-brand-600" />
    </label>
  );
}

function TypePicker({ value, onChange }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Chart type</h2>
      <div className="grid grid-cols-3 gap-1.5">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`rounded-md border py-1.5 text-xs font-medium transition ${
              value === t.id
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- insert new chart --------------------------- */

function InsertForm({ controllerRef }) {
  const [type, setType] = useState("column");
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const c = () => controllerRef.current;

  const setRow = (i, patch) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
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
    <div className="flex flex-col gap-4">
      <TypePicker value={type} onChange={setType} />

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
          <button type="button" onClick={addRow} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
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
        The chart is added as an editable group. Select it to change its type,
        title, or data here at any time.
      </p>
    </div>
  );
}

/* ------------------------ edit the selected chart ----------------------- */

function Editor({ spec, controllerRef }) {
  const c = () => controllerRef.current;
  const push = (next) => c()?.rebuildActiveChart(next);
  const data = Array.isArray(spec.data) ? spec.data : [];
  const dataKey = `${spec.type}-${data.length}`;

  const setType = (t) => push({ ...clone(spec), type: t });
  const setTitle = (title) => push({ ...clone(spec), title });
  const setCell = (i, patch) => {
    const s = clone(spec);
    s.data[i] = { ...(s.data[i] || {}), ...patch };
    push(s);
  };
  const addRow = () => {
    if (data.length >= 12) return;
    const s = clone(spec);
    s.data = [...(s.data || []), { label: `Item ${data.length + 1}`, value: 10 }];
    push(s);
  };
  const removeRow = (i) => {
    if (data.length <= 1) return;
    const s = clone(spec);
    s.data = s.data.filter((_, idx) => idx !== i);
    push(s);
  };

  const isLine = (spec.type || "column") === "line";
  const colorAt = (i) => (spec.colors && spec.colors[i]) || PALETTE[i % PALETTE.length];
  const setColor = (i, hex) => {
    const s = clone(spec);
    const cols = s.colors && s.colors.length ? [...s.colors] : [];
    while (cols.length < data.length) cols.push(PALETTE[cols.length % PALETTE.length]);
    cols[i] = hex;
    s.colors = cols;
    push(s);
  };
  const resetColors = () => {
    const s = clone(spec);
    delete s.colors;
    push(s);
  };

  const isPie = (spec.type || "column") === "pie" || spec.type === "donut";
  const flag = (key) => spec[key] !== false; // default on
  const setFlag = (key, on) => push({ ...clone(spec), [key]: on });

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-brand-50 px-3 py-2 text-[11px] font-medium text-brand-700">
        Editing selected chart — changes apply live.
      </div>

      <TypePicker value={spec.type || "column"} onChange={setType} />

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Title (optional)</h2>
        <input
          key={`${dataKey}-title`}
          defaultValue={spec.title || ""}
          onBlur={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          placeholder="Chart title"
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
        />
      </div>

      {isLine && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Line color</span>
          <input
            type="color"
            value={colorAt(0)}
            onChange={(e) => setColor(0, e.target.value)}
            className="h-8 w-10 cursor-pointer rounded-md border border-slate-200 bg-white p-0.5"
            aria-label="Line color"
          />
        </div>
      )}

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Labels &amp; axis</h2>
        <div className="space-y-1.5">
          <Toggle label={isPie ? "Show percentages" : "Value labels"} checked={flag("showValues")} onChange={(v) => setFlag("showValues", v)} />
          {!isPie && (
            <>
              <Toggle label="Gridlines" checked={flag("showGrid")} onChange={(v) => setFlag("showGrid", v)} />
              <Toggle label="Axis & scale" checked={flag("showAxis")} onChange={(v) => setFlag("showAxis", v)} />
            </>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Data</h2>
          <div className="flex items-center gap-2">
            {spec.colors && (
              <button type="button" onClick={resetColors} className="text-[11px] font-medium text-slate-500 hover:text-brand-600 hover:underline">Reset colors</button>
            )}
            <button type="button" onClick={addRow} disabled={data.length >= 12} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <Plus size={13} /> Row
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          {data.map((row, i) => (
            <div key={`${dataKey}-${i}`} className="flex items-center gap-1.5">
              {!isLine && (
                <input
                  type="color"
                  value={colorAt(i)}
                  onChange={(e) => setColor(i, e.target.value)}
                  className="h-8 w-7 shrink-0 cursor-pointer rounded-md border border-slate-200 bg-white p-0.5"
                  aria-label={`Series ${i + 1} color`}
                />
              )}
              <input
                defaultValue={row.label}
                onBlur={(e) => setCell(i, { label: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                placeholder="Label"
                className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
              />
              <input
                type="number"
                defaultValue={row.value}
                onBlur={(e) => setCell(i, { value: Number(e.target.value) || 0 })}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                className="w-20 rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
                aria-label="Value"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={data.length <= 1}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                aria-label="Remove row"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-auto rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-400">
        Type a label/value and click away (or press Enter) to apply. Move or
        resize the chart on the canvas with its handles.
      </p>
    </div>
  );
}

export default function ChartsPanel({ controllerRef }) {
  const selection = useEditorStore((s) => s.selection);
  const isChart = selection?.isChart && selection?.chart;

  return (
    <div className="ds-scroll flex h-full flex-col gap-4 overflow-y-auto p-4">
      {isChart ? (
        <Editor key={selection.id} spec={selection.chart} controllerRef={controllerRef} />
      ) : (
        <InsertForm controllerRef={controllerRef} />
      )}
    </div>
  );
}
