"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shapes,
  SlidersHorizontal,
  Layers as LayersIcon,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";
import { saveProject, createBlankPage } from "@/lib/db/projects";
import CanvasStage from "@/components/editor/CanvasStage";
import Toolbar from "@/components/editor/Toolbar";
import ElementsPanel from "@/components/editor/ElementsPanel";
import PropertiesPanel from "@/components/editor/PropertiesPanel";
import LayersPanel from "@/components/editor/LayersPanel";
import BackgroundsPanel from "@/components/editor/BackgroundsPanel";
import BrandKitPanel from "@/components/editor/BrandKitPanel";
import TemplatesPanel from "@/components/editor/TemplatesPanel";
import AlignBar from "@/components/editor/AlignBar";
import ContextMenu from "@/components/editor/ContextMenu";
import PagesBar from "@/components/editor/PagesBar";
import ExportDialog from "@/components/editor/ExportDialog";
import PresentMode from "@/components/editor/PresentMode";

function newPageId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `pg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function Editor({ project }) {
  const router = useRouter();
  const controllerRef = useRef(null);
  const fitRef = useRef(null);
  const clipboardRef = useRef(null); // in-app copy/paste buffer (serialized objects)
  const [toast, setToast] = useState(null);
  const [leftTab, setLeftTab] = useState("elements");
  const [menu, setMenu] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [present, setPresent] = useState(null); // { pages, index } | null

  // Multi-page document state. `pagesRef` mirrors it so the autosave callback
  // and page operations always read the latest without stale closures.
  const [pages, setPages] = useState(() => project.pages);
  const [activePageId, setActivePageId] = useState(() => project.activePageId);
  const pagesRef = useRef({ pages: project.pages, activePageId: project.activePageId });
  pagesRef.current = { pages, activePageId };

  const canvasReady = useEditorStore((s) => s.canvasReady);
  const loadError = useEditorStore((s) => s.loadError);
  const selection = useEditorStore((s) => s.selection);
  const mobilePanel = useEditorStore((s) => s.mobilePanel);
  const setMobilePanel = useEditorStore((s) => s.setMobilePanel);
  const rev = useEditorStore((s) => s.rev);

  const initialPage =
    project.pages.find((p) => p.id === project.activePageId) || project.pages[0];

  // Seed store + page state when the project changes.
  useEffect(() => {
    const store = useEditorStore.getState();
    store.reset();
    store.setProject({ id: project.id, name: project.name, type: project.type });
    store.setProjectName(project.name || "");
    setPages(project.pages);
    setActivePageId(project.activePageId);
    pagesRef.current = { pages: project.pages, activePageId: project.activePageId };
    return () => useEditorStore.getState().reset();
  }, [project.id, project.name, project.type, project.pages, project.activePageId]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  /* --------------------------- page helpers -------------------------- */

  // Dev-only handle for automated testing of page operations.
  const expose = (api) => {
    if (process.env.NODE_ENV !== "production") window.__pages = api;
  };

  // Serialize the live canvas into the active page entry.
  const captureActive = useCallback((ps, activeId) => {
    const c = controllerRef.current;
    if (!c) return ps;
    const json = c.toJSON();
    const thumbnail = c.getThumbnail();
    return ps.map((p) => (p.id === activeId ? { ...p, json, thumbnail } : p));
  }, []);

  const applyPages = useCallback((ps, activeId) => {
    pagesRef.current = {
      pages: ps,
      activePageId: activeId ?? pagesRef.current.activePageId,
    };
    setPages(ps);
    if (activeId !== undefined) setActivePageId(activeId);
  }, []);

  const markDirty = () => useEditorStore.getState().markDirty();
  // Re-fit the view after a page load (its dimensions may differ).
  const afterLoad = () => requestAnimationFrame(() => fitRef.current?.());

  const switchPage = useCallback(
    (id) => {
      const c = controllerRef.current;
      if (!c || id === pagesRef.current.activePageId) return;
      const captured = captureActive(
        pagesRef.current.pages,
        pagesRef.current.activePageId
      );
      const target = captured.find((p) => p.id === id);
      if (!target) return;
      applyPages(captured, id);
      c.loadPage(id, target.json, { width: target.width, height: target.height });
      afterLoad();
      markDirty();
    },
    [captureActive, applyPages]
  );

  const addPage = useCallback(() => {
    const c = controllerRef.current;
    if (!c) return;
    const captured = captureActive(
      pagesRef.current.pages,
      pagesRef.current.activePageId
    );
    const np = createBlankPage({
      name: `Page ${captured.length + 1}`,
      width: project.width,
      height: project.height,
    });
    np.id = newPageId();
    const idx = captured.findIndex((p) => p.id === pagesRef.current.activePageId);
    const next = [...captured.slice(0, idx + 1), np, ...captured.slice(idx + 1)];
    applyPages(next, np.id);
    c.loadPage(np.id, np.json, { width: np.width, height: np.height });
    afterLoad();
    markDirty();
  }, [captureActive, applyPages, project.width, project.height]);

  const duplicatePage = useCallback(
    (id) => {
      const c = controllerRef.current;
      if (!c) return;
      const captured = captureActive(
        pagesRef.current.pages,
        pagesRef.current.activePageId
      );
      const srcIdx = captured.findIndex((p) => p.id === id);
      if (srcIdx < 0) return;
      const src = captured[srcIdx];
      const copy = { ...src, id: newPageId(), name: `${src.name} copy` };
      const next = [
        ...captured.slice(0, srcIdx + 1),
        copy,
        ...captured.slice(srcIdx + 1),
      ];
      applyPages(next, copy.id);
      c.loadPage(copy.id, copy.json, { width: copy.width, height: copy.height });
      afterLoad();
      markDirty();
    },
    [captureActive, applyPages]
  );

  const deletePage = useCallback(
    (id) => {
      const c = controllerRef.current;
      if (!c) return;
      const { pages: cur, activePageId: act } = pagesRef.current;
      if (cur.length <= 1) return;
      const idx = cur.findIndex((p) => p.id === id);
      if (idx < 0) return;

      let base = cur;
      let newActive = act;
      let needLoad = false;
      if (id === act) {
        const neighbor = cur[idx - 1] || cur[idx + 1];
        newActive = neighbor.id;
        needLoad = true; // the deleted page was active; load the neighbour
      } else {
        base = captureActive(cur, act); // keep the still-active page current
      }
      const next = base.filter((p) => p.id !== id);
      applyPages(next, newActive);
      c.dropPageHistory(id);
      if (needLoad) {
        const target = next.find((p) => p.id === newActive);
        c.loadPage(newActive, target.json, {
          width: target.width,
          height: target.height,
        });
        afterLoad();
      }
      markDirty();
    },
    [captureActive, applyPages]
  );

  const reorderPage = useCallback(
    (id, dir) => {
      const captured = captureActive(
        pagesRef.current.pages,
        pagesRef.current.activePageId
      );
      const idx = captured.findIndex((p) => p.id === id);
      const swap = dir === "left" ? idx - 1 : idx + 1;
      if (idx < 0 || swap < 0 || swap >= captured.length) return;
      const next = [...captured];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      applyPages(next);
      markDirty();
    },
    [captureActive, applyPages]
  );

  const renamePage = useCallback(
    (id, name) => {
      const next = pagesRef.current.pages.map((p) =>
        p.id === id ? { ...p, name } : p
      );
      applyPages(next);
      markDirty();
    },
    [applyPages]
  );

  // Resize the active page (or all pages). Dimensions live in the page model;
  // the live canvas is resized immediately and the view re-fits.
  const resizePage = useCallback(
    (width, height, allPages = false) => {
      const c = controllerRef.current;
      if (!c || !width || !height) return;
      const { pages: cur, activePageId: act } = pagesRef.current;
      const next = cur.map((p) =>
        allPages || p.id === act ? { ...p, width, height } : p
      );
      applyPages(next);
      c.setPageDimensions(width, height);
      afterLoad();
      markDirty();
    },
    [applyPages]
  );

  /* ----------------------------- save -------------------------------- */

  const doSave = useCallback(async () => {
    const c = controllerRef.current;
    if (!c) return;
    const store = useEditorStore.getState();
    store.setSaving(true);
    try {
      const { pages: curPages, activePageId: curActive } = pagesRef.current;
      const captured = captureActive(curPages, curActive);
      pagesRef.current = { pages: captured, activePageId: curActive };
      setPages(captured);
      const cover =
        captured.find((p) => p.id === curActive)?.thumbnail ||
        captured[0]?.thumbnail ||
        null;
      await saveProject(project.id, {
        pages: captured,
        activePageId: curActive,
        thumbnail: cover,
        name: store.projectName,
      });
      store.markSaved();
    } catch (err) {
      console.error("Save failed:", err);
      store.setSaving(false);
      showToast("Could not save the project.");
    }
  }, [project.id, captureActive, showToast]);

  // Debounced autosave: every canvas change or page op bumps `rev`.
  useEffect(() => {
    if (rev === 0) return;
    const t = setTimeout(() => {
      doSave();
    }, 1200);
    return () => clearTimeout(t);
  }, [rev, doSave]);

  // Design recovery: flush any pending (debounced) save before the page is
  // hidden or unloaded (refresh, tab close, tab switch, mobile background), so
  // the last edit can't be lost in the debounce window. Best-effort — the write
  // is kicked off while the page is still alive.
  useEffect(() => {
    const flush = () => {
      if (useEditorStore.getState().isDirty) doSave();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [doSave]);

  expose({
    get: () => pagesRef.current,
    switch: (id) => switchPage(id),
    add: () => addPage(),
    duplicate: (id) => duplicatePage(id),
    delete: (id) => deletePage(id),
    reorder: (id, dir) => reorderPage(id, dir),
    rename: (id, name) => renamePage(id, name),
    resize: (w, h, all) => resizePage(w, h, all),
    save: () => doSave(),
  });

  /* --------------------------- shortcuts ----------------------------- */

  useEffect(() => {
    function onKeyDown(e) {
      const c = controllerRef.current;
      if (!c) return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const inField =
        tag === "input" || tag === "textarea" || e.target?.isContentEditable;
      const active = c.getActive?.();
      const editingText = active && active.isEditing;
      const meta = e.ctrlKey || e.metaKey;
      const key = e.key;

      if (key === "Escape") {
        setMenu(null);
        if (!editingText) c.deselect();
        return;
      }
      if (inField || editingText) return;

      if (meta && (key === "z" || key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) c.redo();
        else c.undo();
      } else if (meta && (key === "y" || key === "Y")) {
        e.preventDefault();
        c.redo();
      } else if (meta && (key === "d" || key === "D")) {
        e.preventDefault();
        c.duplicateActive();
      } else if (meta && key === "a") {
        e.preventDefault();
        c.selectAll();
      } else if (meta && e.shiftKey && (key === "g" || key === "G")) {
        e.preventDefault();
        c.ungroup();
      } else if (meta && (key === "g" || key === "G")) {
        e.preventDefault();
        c.group();
      } else if (meta && key === "]") {
        e.preventDefault();
        c.bringForward();
      } else if (meta && key === "[") {
        e.preventDefault();
        c.sendBackward();
      } else if (meta && (key === "c" || key === "C")) {
        // Copy selection to our in-app clipboard. With nothing selected we don't
        // preventDefault, so the browser's own copy still works.
        const objs = c.copySelection?.();
        if (objs && objs.length) {
          e.preventDefault();
          clipboardRef.current = objs;
        }
      } else if (meta && (key === "v" || key === "V")) {
        // Paste our clipboard if we have one; otherwise let the browser handle it.
        if (clipboardRef.current && clipboardRef.current.length) {
          e.preventDefault();
          c.insertComponent(clipboardRef.current);
        }
      } else if (key === "Delete" || key === "Backspace") {
        e.preventDefault();
        c.deleteActive();
      } else if (key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (key === "ArrowLeft") c.nudge(-step, 0);
        else if (key === "ArrowRight") c.nudge(step, 0);
        else if (key === "ArrowUp") c.nudge(0, -step);
        else if (key === "ArrowDown") c.nudge(0, step);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* ----------------------------- export ------------------------------ */

  function safeBase() {
    return (
      (useEditorStore.getState().projectName || "design")
        .replace(/[^\w-]+/g, "_")
        .replace(/^_+|_+$/g, "") || "design"
    );
  }

  function triggerDownload(href, filename, revoke) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (revoke) setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  async function exportAllPagesPDF(base, scale = 1) {
    const c = controllerRef.current;
    const { jsPDF } = await import("jspdf");
    const { pages: cur, activePageId: act } = pagesRef.current;
    const captured = captureActive(cur, act);
    let pdf = null;
    for (let i = 0; i < captured.length; i++) {
      const pg = captured[i];
      const dataURL = await c.renderPageJSON(pg.json, pg.width, pg.height, scale);
      const orientation = pg.width >= pg.height ? "l" : "p";
      if (i === 0) {
        pdf = new jsPDF({ orientation, unit: "px", format: [pg.width, pg.height], hotfixes: ["px_scaling"] });
      } else {
        pdf.addPage([pg.width, pg.height], orientation);
      }
      pdf.addImage(dataURL, "PNG", 0, 0, pg.width, pg.height);
    }
    pdf.save(`${base}.pdf`);
  }

  // Driven by the ExportDialog. Throws on failure so the dialog can show it.
  async function handleExport(opts = {}) {
    const c = controllerRef.current;
    if (!c) throw new Error("Canvas is not ready.");
    const base = safeBase();
    const { format = "png", scale = 1, transparent = false, pages = "current", quality = 0.92 } = opts;

    if (format === "svg") {
      const svg = c.exportSVG();
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      triggerDownload(url, `${base}.svg`, true);
      return;
    }
    if (format === "pdf") {
      await exportAllPagesPDF(base, scale);
      return;
    }

    const ext = format === "jpg" ? "jpg" : "png";
    // All pages → one raster file per page.
    if (pages === "all" && pagesRef.current.pages.length > 1) {
      const captured = captureActive(pagesRef.current.pages, pagesRef.current.activePageId);
      for (let i = 0; i < captured.length; i++) {
        const pg = captured[i];
        const dataURL = await c.renderPageJSON(pg.json, pg.width, pg.height, scale, {
          transparent: format === "png" && transparent,
          format: format === "jpg" ? "jpeg" : "png",
          quality,
        });
        triggerDownload(dataURL, `${base}-page-${i + 1}.${ext}`);
        await new Promise((r) => setTimeout(r, 150)); // let the browser accept multiple downloads
      }
      return;
    }

    // Current page.
    const pageIdx = pagesRef.current.pages.findIndex((p) => p.id === pagesRef.current.activePageId);
    const suffix = pagesRef.current.pages.length > 1 ? `-page-${pageIdx + 1}` : "";
    const url =
      format === "jpg"
        ? c.exportJPG({ quality, multiplier: scale })
        : c.exportPNG({ multiplier: scale, transparent });
    triggerDownload(url, `${base}${suffix}.${ext}`);
  }

  function handlePresent() {
    const captured = captureActive(pagesRef.current.pages, pagesRef.current.activePageId);
    const index = Math.max(0, captured.findIndex((p) => p.id === pagesRef.current.activePageId));
    setPresent({ pages: captured, index });
  }

  async function handleBack() {
    // Save any pending change before leaving the editor so nothing is lost.
    try {
      if (useEditorStore.getState().isDirty) await doSave();
    } catch {
      /* best-effort; navigation proceeds regardless */
    }
    router.push("/");
  }

  const leftTabBtn = (id, label) => (
    <button
      type="button"
      onClick={() => setLeftTab(id)}
      className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-[12px] font-medium transition ${
        leftTab === id
          ? "border-brand-500 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-100">
      <Toolbar
        controllerRef={controllerRef}
        onBack={handleBack}
        onExport={() => setShowExport(true)}
        onPresent={handlePresent}
        onSave={doSave}
        onFit={() => fitRef.current?.()}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
          <div className="ds-scroll flex overflow-x-auto border-b border-slate-200">
            {leftTabBtn("elements", "Elements")}
            {leftTabBtn("backgrounds", "Background")}
            {leftTabBtn("brand", "Brand")}
            {leftTabBtn("layers", "Layers")}
            {leftTabBtn("templates", "Templates")}
          </div>
          <div className="ds-scroll min-h-0 flex-1 overflow-y-auto">
            {leftTab === "elements" ? (
              <ElementsPanel controllerRef={controllerRef} />
            ) : leftTab === "backgrounds" ? (
              <BackgroundsPanel controllerRef={controllerRef} />
            ) : leftTab === "brand" ? (
              <BrandKitPanel controllerRef={controllerRef} />
            ) : leftTab === "layers" ? (
              <LayersPanel controllerRef={controllerRef} />
            ) : (
              <TemplatesPanel controllerRef={controllerRef} />
            )}
          </div>
        </aside>

        <main className="relative min-w-0 flex-1">
          <CanvasStage
            project={project}
            controllerRef={controllerRef}
            fitRef={fitRef}
            onContextMenu={setMenu}
            initialPageId={initialPage.id}
            initialPageJson={initialPage.json}
            initialPageWidth={initialPage.width}
            initialPageHeight={initialPage.height}
          />

          {canvasReady && selection && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
              <AlignBar controllerRef={controllerRef} />
            </div>
          )}

          {!canvasReady && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100/70">
              <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={18} className="animate-spin" /> Preparing canvas…
              </span>
            </div>
          )}

          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-sm rounded-xl border border-rose-200 bg-white p-5 text-center shadow-sm">
                <AlertTriangle size={24} className="mx-auto mb-2 text-rose-500" />
                <p className="text-sm font-medium text-slate-800">{loadError}</p>
                <button
                  type="button"
                  onClick={handleBack}
                  className="mt-3 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
                >
                  Back to projects
                </button>
              </div>
            </div>
          )}
        </main>

        <aside className="ds-scroll hidden w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white md:block">
          <PropertiesPanel controllerRef={controllerRef} onResizePage={resizePage} />
        </aside>
      </div>

      {/* Page filmstrip (all viewports) */}
      <PagesBar
        pages={pages}
        activePageId={activePageId}
        onSwitch={switchPage}
        onAdd={addPage}
        onDuplicate={duplicatePage}
        onDelete={deletePage}
        onReorder={reorderPage}
        onRename={renamePage}
      />

      {/* Mobile: bottom action bar */}
      <nav className="flex items-center justify-around border-t border-slate-200 bg-white p-1 md:hidden">
        <button
          type="button"
          onClick={() =>
            setMobilePanel(mobilePanel === "elements" ? null : "elements")
          }
          className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-xs ${
            mobilePanel === "elements" ? "text-brand-700" : "text-slate-500"
          }`}
        >
          <Shapes size={20} />
          Add
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel(mobilePanel === "layers" ? null : "layers")}
          className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-xs ${
            mobilePanel === "layers" ? "text-brand-700" : "text-slate-500"
          }`}
        >
          <LayersIcon size={20} />
          Layers
        </button>
        <button
          type="button"
          onClick={() =>
            setMobilePanel(mobilePanel === "properties" ? null : "properties")
          }
          className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-xs ${
            mobilePanel === "properties" ? "text-brand-700" : "text-slate-500"
          }`}
        >
          <SlidersHorizontal size={20} />
          Edit
        </button>
      </nav>

      {mobilePanel && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex max-h-[72vh] flex-col rounded-t-2xl border-t border-slate-200 bg-white shadow-2xl md:hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold capitalize text-slate-700">
              {mobilePanel === "elements"
                ? "Add elements"
                : mobilePanel === "layers"
                ? "Layers"
                : "Edit"}
            </span>
            <button
              type="button"
              onClick={() => setMobilePanel(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="ds-scroll min-h-0 flex-1 overflow-y-auto">
            {mobilePanel === "elements" ? (
              <ElementsPanel controllerRef={controllerRef} />
            ) : mobilePanel === "layers" ? (
              <LayersPanel controllerRef={controllerRef} />
            ) : (
              <PropertiesPanel controllerRef={controllerRef} onResizePage={resizePage} />
            )}
          </div>
        </div>
      )}

      <ContextMenu
        menu={menu}
        controllerRef={controllerRef}
        onClose={() => setMenu(null)}
      />

      {showExport && (
        <ExportDialog
          pageCount={pages.length}
          pageSize={pages.find((p) => p.id === activePageId) || pages[0] || { width: 0, height: 0 }}
          onClose={() => setShowExport(false)}
          onExport={handleExport}
        />
      )}

      {present && (
        <PresentMode
          pages={present.pages}
          startIndex={present.index}
          controllerRef={controllerRef}
          onClose={() => setPresent(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg md:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
