"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  ChevronDown,
  Check,
  Loader2,
} from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";

function IconButton({ title, onClick, disabled, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export default function Toolbar({ controllerRef, onBack, onExport, onSave, onFit }) {
  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const zoom = useEditorStore((s) => s.zoom);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const isSaving = useEditorStore((s) => s.isSaving);
  const isDirty = useEditorStore((s) => s.isDirty);
  const canvasReady = useEditorStore((s) => s.canvasReady);

  const c = () => controllerRef.current;

  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);
  useEffect(() => {
    function onDown(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  const pick = (fmt) => {
    setExportOpen(false);
    onExport(fmt);
  };

  return (
    <header className="flex h-14 items-center gap-1 border-b border-slate-200 bg-white px-2 sm:gap-2 sm:px-4">
      <IconButton title="Back to projects" onClick={onBack}>
        <ArrowLeft size={18} />
      </IconButton>

      {/* ATLAS Creative Hub brand mark */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/atlas-symbol.svg"
        alt="ATLAS Creative Hub"
        width={22}
        height={22}
        className="ml-0.5 mr-1 hidden h-[22px] w-[22px] shrink-0 sm:block"
      />

      <input
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        onBlur={onSave}
        placeholder="Untitled"
        aria-label="Project name"
        className="min-w-0 max-w-[40vw] flex-1 truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-900 outline-none hover:border-slate-200 focus:border-brand-500 focus:bg-white sm:max-w-xs"
      />

      <div className="hidden items-center text-xs text-slate-400 sm:flex">
        {isSaving ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 size={13} className="animate-spin" /> Saving…
          </span>
        ) : isDirty ? (
          <span>Unsaved changes</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <Check size={13} /> Saved
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        <IconButton
          title="Undo (Ctrl+Z)"
          onClick={() => c()?.undo()}
          disabled={!canUndo}
        >
          <Undo2 size={18} />
        </IconButton>
        <IconButton
          title="Redo (Ctrl+Shift+Z)"
          onClick={() => c()?.redo()}
          disabled={!canRedo}
        >
          <Redo2 size={18} />
        </IconButton>

        <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />

        <div className="hidden items-center sm:flex">
          <IconButton title="Zoom out" onClick={() => c()?.zoomOut()}>
            <ZoomOut size={18} />
          </IconButton>
          <span className="w-12 text-center text-xs font-medium tabular-nums text-slate-500">
            {Math.round(zoom * 100)}%
          </span>
          <IconButton title="Zoom in" onClick={() => c()?.zoomIn()}>
            <ZoomIn size={18} />
          </IconButton>
          <IconButton title="Fit to screen" onClick={onFit}>
            <Maximize size={18} />
          </IconButton>
        </div>

        <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />

        <div className="relative" ref={exportRef}>
          <button
            type="button"
            onClick={() => setExportOpen((v) => !v)}
            disabled={!canvasReady}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown size={14} />
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
              <button
                type="button"
                onClick={() => pick("png")}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                PNG <span className="text-slate-400">· this page</span>
              </button>
              <button
                type="button"
                onClick={() => pick("jpg")}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                JPG <span className="text-slate-400">· this page</span>
              </button>
              <button
                type="button"
                onClick={() => pick("svg")}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                SVG <span className="text-slate-400">· this page</span>
              </button>
              <button
                type="button"
                onClick={() => pick("pdf")}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                PDF <span className="text-slate-400">· all pages</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
