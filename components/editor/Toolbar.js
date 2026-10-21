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
  Check,
  Loader2,
  Ruler,
  Magnet,
  Grid3x3,
  Play,
  Keyboard,
  Cloud,
  CloudOff,
  AlertTriangle,
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

export default function Toolbar({ controllerRef, onBack, onExport, onPresent, onSave, onFit, onHelp }) {
  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const zoom = useEditorStore((s) => s.zoom);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const isSaving = useEditorStore((s) => s.isSaving);
  const isDirty = useEditorStore((s) => s.isDirty);
  const cloudStatus = useEditorStore((s) => s.cloudStatus);
  const canvasReady = useEditorStore((s) => s.canvasReady);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled);
  const showRulers = useEditorStore((s) => s.showRulers);
  const setShowRulers = useEditorStore((s) => s.setShowRulers);
  const showGrid = useEditorStore((s) => s.showGrid);
  const setShowGrid = useEditorStore((s) => s.setShowGrid);
  const gridSize = useEditorStore((s) => s.gridSize);
  const setGridSize = useEditorStore((s) => s.setGridSize);

  const c = () => controllerRef.current;

  const [viewOpen, setViewOpen] = useState(false);
  const viewRef = useRef(null);
  useEffect(() => {
    if (!viewOpen) return;
    function onDown(e) {
      if (viewRef.current && !viewRef.current.contains(e.target)) setViewOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [viewOpen]);

  function toggleSnap() {
    const next = !snapEnabled;
    setSnapEnabled(next);
    controllerRef.current?.setSnapEnabled(next);
  }

  function toggleGrid() {
    const next = !showGrid;
    setShowGrid(next);
    controllerRef.current?.setGridVisible(next);
  }

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

      <div className="hidden items-center gap-3 text-xs text-slate-400 sm:flex">
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
        {/* Automatic cloud-sync status (only when there's something to report). */}
        {cloudStatus === "saving" && (
          <span className="inline-flex items-center gap-1 text-slate-400">
            <Loader2 size={13} className="animate-spin" /> Syncing…
          </span>
        )}
        {cloudStatus === "saved" && (
          <span className="inline-flex items-center gap-1 text-emerald-600" title="Saved to your cloud account">
            <Cloud size={13} /> Synced
          </span>
        )}
        {cloudStatus === "offline" && (
          <span className="inline-flex items-center gap-1 text-slate-400" title="You're offline — changes are saved on this device and will sync when you reconnect">
            <CloudOff size={13} /> Offline
          </span>
        )}
        {cloudStatus === "failed" && (
          <span className="inline-flex items-center gap-1 text-amber-600" title="Cloud sync failed — changes are saved on this device and will retry">
            <AlertTriangle size={13} /> Sync failed
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

        <div className="relative" ref={viewRef}>
          <IconButton title="View options (rulers, snapping)" onClick={() => setViewOpen((v) => !v)}>
            <Ruler size={18} />
          </IconButton>
          {viewOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
              <button
                type="button"
                onClick={() => setShowRulers(!showRulers)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                <span className="inline-flex items-center gap-2"><Ruler size={15} /> Rulers</span>
                <span className={`text-xs font-medium ${showRulers ? "text-brand-600" : "text-slate-400"}`}>{showRulers ? "On" : "Off"}</span>
              </button>
              <button
                type="button"
                onClick={toggleSnap}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                <span className="inline-flex items-center gap-2"><Magnet size={15} /> Snap to guides</span>
                <span className={`text-xs font-medium ${snapEnabled ? "text-brand-600" : "text-slate-400"}`}>{snapEnabled ? "On" : "Off"}</span>
              </button>
              <button
                type="button"
                onClick={toggleGrid}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                <span className="inline-flex items-center gap-2"><Grid3x3 size={15} /> Grid</span>
                <span className={`text-xs font-medium ${showGrid ? "text-brand-600" : "text-slate-400"}`}>{showGrid ? "On" : "Off"}</span>
              </button>
              {showGrid && (
                <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-600">
                  <span>Grid size</span>
                  <select
                    value={gridSize}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setGridSize(v);
                      controllerRef.current?.setGridSize(v);
                    }}
                    className="rounded-md border border-slate-200 px-1.5 py-1 text-xs text-slate-700 outline-none focus:border-brand-500"
                  >
                    {[10, 20, 50, 100].map((s) => (
                      <option key={s} value={s}>{s} px</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="my-1 border-t border-slate-100" />
              <p className="px-3 py-1 text-[11px] text-slate-400">Click a ruler to add a guide · Alt-click to remove the nearest.</p>
              <button
                type="button"
                onClick={() => { setViewOpen(false); controllerRef.current?.clearGuides(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                <Ruler size={15} /> Clear guides
              </button>
            </div>
          )}
        </div>

        <IconButton title="Present (fullscreen)" onClick={() => onPresent?.()} disabled={!canvasReady}>
          <Play size={18} />
        </IconButton>

        <IconButton title="Keyboard shortcuts (?)" onClick={() => onHelp?.()}>
          <Keyboard size={18} />
        </IconButton>

        <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />

        <button
          type="button"
          onClick={() => onExport()}
          disabled={!canvasReady}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download size={16} />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>
    </header>
  );
}
