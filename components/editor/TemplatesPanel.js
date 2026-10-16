"use client";

import { useEffect, useState } from "react";
import { LayoutTemplate, Save, Trash2, Component } from "lucide-react";
import { TEMPLATES } from "@/lib/templates";
import {
  saveComponent,
  listComponents,
  deleteComponent,
} from "@/lib/db/projects";
import { useEditorStore } from "@/lib/store/editorStore";

export default function TemplatesPanel({ controllerRef }) {
  const selection = useEditorStore((s) => s.selection);
  const [components, setComponents] = useState([]);
  const [busy, setBusy] = useState(false);
  const c = () => controllerRef.current;

  async function refresh() {
    try {
      setComponents(await listComponents());
    } catch {
      setComponents([]);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function applyTemplate(t) {
    const ctrl = c();
    if (!ctrl) return;
    const hasContent = ctrl.canvas.getObjects().length > 0;
    if (hasContent && !window.confirm("Replace this page with the template?")) {
      return;
    }
    ctrl.applyTemplate(t);
  }

  async function saveSelection() {
    const ctrl = c();
    if (!ctrl) return;
    const comp = ctrl.exportSelection();
    if (!comp) return;
    setBusy(true);
    try {
      await saveComponent(comp);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeComponent(e, id) {
    e.stopPropagation();
    try {
      await deleteComponent(id);
      await refresh();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="ds-scroll flex h-full flex-col gap-5 overflow-y-auto p-4">
      <div>
        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <LayoutTemplate size={13} /> Templates
        </h2>
        <div className="grid grid-cols-1 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-500 hover:shadow-sm"
            >
              <span
                className="flex h-10 w-16 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-white"
                style={{ background: t.background }}
              >
                Aa
              </span>
              <span className="text-sm font-medium text-slate-700">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Component size={13} /> My components
        </h2>
        <button
          type="button"
          onClick={saveSelection}
          disabled={!selection || busy}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-600 transition hover:border-brand-400 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save size={16} />
          Save selection as component
        </button>

        {components.length === 0 ? (
          <p className="text-xs text-slate-400">
            Select object(s) and save them to reuse across pages and projects.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {components.map((comp) => (
              <button
                key={comp.id}
                type="button"
                onClick={() => c()?.insertComponent(comp.objects)}
                className="group relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition hover:border-brand-400"
                title={`Insert ${comp.name}`}
              >
                <div className="flex aspect-video items-center justify-center bg-slate-50">
                  {comp.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={comp.thumbnail}
                      alt={comp.name}
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <Component size={18} className="text-slate-300" />
                  )}
                </div>
                <span className="truncate px-2 py-1 text-[11px] text-slate-600">
                  {comp.name}
                </span>
                <span
                  role="button"
                  aria-label="Delete component"
                  onClick={(e) => removeComponent(e, comp.id)}
                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded bg-white/90 text-slate-400 opacity-0 shadow-sm transition hover:text-rose-600 group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
