"use client";

import { useState } from "react";
import {
  Table as TableIcon,
  Plus,
  Minus,
  Bold,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";

// A table is a Fabric group rebuilt from a `table` spec stored on it, so it
// persists, exports, and undoes like any element. All edits here produce a new
// spec and call controller.rebuildActiveTable, making each change one step.

const DEFAULT_COL_W = 120;
const DEFAULT_ROW_H = 40;

function makeCells(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({}))
  );
}

function makeSpec(rows, cols, headerRow) {
  return {
    rows,
    cols,
    headerRow,
    colWidths: Array(cols).fill(DEFAULT_COL_W),
    rowHeights: Array(rows).fill(DEFAULT_ROW_H),
    border: { color: "#cbd5e1", width: 1 },
    fontSize: 14,
    cells: makeCells(rows, cols),
  };
}

const clone = (s) => JSON.parse(JSON.stringify(s));

function InsertForm({ controllerRef }) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [header, setHeader] = useState(true);
  const c = () => controllerRef.current;

  const clamp = (n) => Math.max(1, Math.min(20, Math.round(Number(n) || 1)));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Rows</label>
          <input
            type="number" min={1} max={20} value={rows}
            onChange={(e) => setRows(clamp(e.target.value))}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Columns</label>
          <input
            type="number" min={1} max={20} value={cols}
            onChange={(e) => setCols(clamp(e.target.value))}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500"
          />
        </div>
      </div>
      <label className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
        <span className="text-sm text-slate-600">Header row</span>
        <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} className="h-4 w-4 accent-brand-600" />
      </label>
      <button
        type="button"
        onClick={() => c()?.addTable(makeSpec(clamp(rows), clamp(cols), header))}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        <TableIcon size={16} /> Insert table
      </button>
      <p className="rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-400">
        The table is inserted as an editable element. Select it to edit cells,
        add/remove rows and columns, and style cells here.
      </p>
    </div>
  );
}

function Editor({ spec, controllerRef }) {
  const c = () => controllerRef.current;
  const [active, setActive] = useState({ r: 0, c: 0 });

  const push = (next) => c()?.rebuildActiveTable(next);

  const addRow = () => {
    const s = clone(spec);
    s.rows += 1;
    s.rowHeights.push(DEFAULT_ROW_H);
    s.cells.push(Array.from({ length: s.cols }, () => ({})));
    push(s);
  };
  const removeRow = () => {
    if (spec.rows <= 1) return;
    const s = clone(spec);
    s.rows -= 1;
    s.rowHeights.pop();
    s.cells.pop();
    push(s);
  };
  const addCol = () => {
    const s = clone(spec);
    s.cols += 1;
    s.colWidths.push(DEFAULT_COL_W);
    s.cells.forEach((row) => row.push({}));
    push(s);
  };
  const removeCol = () => {
    if (spec.cols <= 1) return;
    const s = clone(spec);
    s.cols -= 1;
    s.colWidths.pop();
    s.cells.forEach((row) => row.pop());
    push(s);
  };
  const setCellText = (r, col, text) => {
    const s = clone(spec);
    if (!s.cells[r]) s.cells[r] = [];
    s.cells[r][col] = { ...(s.cells[r][col] || {}), text };
    push(s);
  };
  const patchActiveCell = (patch) => {
    const { r, c: col } = active;
    if (r >= spec.rows || col >= spec.cols || !spec.cells[r]) return;
    const s = clone(spec);
    s.cells[r][col] = { ...(s.cells[r][col] || {}), ...patch };
    push(s);
  };
  const setProp = (patch) => push({ ...clone(spec), ...patch });
  const setColWidth = (w) => {
    if (active.c >= spec.cols) return;
    const s = clone(spec);
    s.colWidths[active.c] = Math.max(20, Math.min(600, Math.round(Number(w) || DEFAULT_COL_W)));
    push(s);
  };
  const setRowHeight = (h) => {
    if (active.r >= spec.rows) return;
    const s = clone(spec);
    s.rowHeights[active.r] = Math.max(16, Math.min(400, Math.round(Number(h) || DEFAULT_ROW_H)));
    push(s);
  };
  const distribute = () => {
    const s = clone(spec);
    s.colWidths = Array(s.cols).fill(DEFAULT_COL_W);
    s.rowHeights = Array(s.rows).fill(DEFAULT_ROW_H);
    push(s);
  };

  const cur = (spec.cells[active.r] && spec.cells[active.r][active.c]) || {};
  const tableKey = `${spec.rows}x${spec.cols}`;

  const alignBtn = (val, Icon) => (
    <button
      type="button"
      title={`Align ${val}`}
      onClick={() => patchActiveCell({ align: val })}
      className={`inline-flex h-8 flex-1 items-center justify-center rounded-md border transition ${
        (cur.align || "left") === val
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      <Icon size={15} />
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Structure */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Structure ({spec.rows} × {spec.cols})
        </h2>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={addRow} className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"><Plus size={13} /> Row</button>
          <button type="button" onClick={removeRow} disabled={spec.rows <= 1} className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Minus size={13} /> Row</button>
          <button type="button" onClick={addCol} className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"><Plus size={13} /> Column</button>
          <button type="button" onClick={removeCol} disabled={spec.cols <= 1} className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Minus size={13} /> Column</button>
        </div>
      </div>

      {/* Cell content */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Cells</h2>
        <div className="ds-scroll overflow-x-auto">
          <div className="flex flex-col gap-1" style={{ minWidth: Math.min(spec.cols, 6) * 92 }}>
            {Array.from({ length: spec.rows }).map((_, r) => (
              <div key={r} className="flex gap-1">
                {Array.from({ length: spec.cols }).map((__, col) => (
                  <input
                    key={`${tableKey}-${r}-${col}`}
                    defaultValue={(spec.cells[r] && spec.cells[r][col] && spec.cells[r][col].text) || ""}
                    onFocus={() => setActive({ r, c: col })}
                    onBlur={(e) => setCellText(r, col, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    placeholder={spec.headerRow && r === 0 ? "Header" : ""}
                    className={`min-w-0 flex-1 rounded border px-1.5 py-1 text-xs text-slate-700 outline-none focus:border-brand-500 ${
                      active.r === r && active.c === col ? "border-brand-400" : "border-slate-200"
                    }`}
                    style={{ width: 88 }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected-cell styling */}
      <div className="space-y-2 rounded-lg bg-slate-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Cell (row {active.r + 1}, col {active.c + 1})
        </p>
        <div className="flex gap-1.5">
          {alignBtn("left", AlignLeft)}
          {alignBtn("center", AlignCenter)}
          {alignBtn("right", AlignRight)}
          <button
            type="button"
            title="Bold"
            onClick={() => patchActiveCell({ bold: !cur.bold })}
            className={`inline-flex h-8 flex-1 items-center justify-center rounded-md border transition ${
              cur.bold ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Bold size={15} />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">Fill</span>
          <div className="flex items-center gap-1.5">
            <input type="color" value={cur.bg || "#ffffff"} onChange={(e) => patchActiveCell({ bg: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-slate-200 bg-white p-0.5" aria-label="Cell fill" />
            <button type="button" onClick={() => patchActiveCell({ bg: "" })} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-white">Clear</button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">Text color</span>
          <input type="color" value={cur.color || "#334155"} onChange={(e) => patchActiveCell({ color: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-slate-200 bg-white p-0.5" aria-label="Cell text color" />
        </div>
      </div>

      {/* Column width / row height for the active cell's column & row */}
      <div className="space-y-2 rounded-lg bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Size (col {active.c + 1}, row {active.r + 1})
          </p>
          <button type="button" onClick={distribute} className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50">Reset all</button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">Column width</span>
          <input
            key={`cw-${active.c}-${spec.colWidths[active.c] ?? DEFAULT_COL_W}`}
            type="number" min={20} max={600}
            defaultValue={spec.colWidths[active.c] ?? DEFAULT_COL_W}
            onBlur={(e) => setColWidth(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className="w-20 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">Row height</span>
          <input
            key={`rh-${active.r}-${spec.rowHeights[active.r] ?? DEFAULT_ROW_H}`}
            type="number" min={16} max={400}
            defaultValue={spec.rowHeights[active.r] ?? DEFAULT_ROW_H}
            onBlur={(e) => setRowHeight(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className="w-20 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Table-level */}
      <div className="space-y-2.5">
        <label className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Header row</span>
          <input type="checkbox" checked={!!spec.headerRow} onChange={(e) => setProp({ headerRow: e.target.checked })} className="h-4 w-4 accent-brand-600" />
        </label>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-slate-600">Font size</span>
          <input
            type="number" min={8} max={72} value={spec.fontSize || 14}
            onChange={(e) => setProp({ fontSize: Math.max(8, Math.min(72, Number(e.target.value) || 14)) })}
            className="w-20 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-slate-600">Border</span>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={(spec.border && spec.border.color) || "#cbd5e1"}
              onChange={(e) => setProp({ border: { ...(spec.border || {}), color: e.target.value, width: (spec.border && spec.border.width) ?? 1 } })}
              className="h-7 w-9 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
              aria-label="Border color"
            />
            <input
              type="number" min={0} max={8} value={(spec.border && spec.border.width) ?? 1}
              onChange={(e) => setProp({ border: { ...(spec.border || {}), color: (spec.border && spec.border.color) || "#cbd5e1", width: Math.max(0, Math.min(8, Number(e.target.value) || 0)) } })}
              className="w-14 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 outline-none focus:border-brand-500"
              aria-label="Border width"
            />
          </div>
        </div>
      </div>

      <p className="rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-400">
        Type in a cell and click away (or press Enter) to apply. Resize or move
        the whole table on the canvas with its handles.
      </p>
    </div>
  );
}

export default function TablesPanel({ controllerRef }) {
  const selection = useEditorStore((s) => s.selection);
  const isTable = selection?.isTable && selection?.table;

  return (
    <div className="ds-scroll flex h-full flex-col gap-4 overflow-y-auto p-4">
      {isTable ? (
        <Editor key={selection.id} spec={selection.table} controllerRef={controllerRef} />
      ) : (
        <InsertForm controllerRef={controllerRef} />
      )}
    </div>
  );
}
