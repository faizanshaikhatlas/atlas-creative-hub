"use client";

import { useEffect, useRef } from "react";
import { CanvasController } from "@/lib/fabric/canvasController";
import { useEditorStore } from "@/lib/store/editorStore";
import Rulers, { RULER } from "@/components/editor/Rulers";

/**
 * Mounts the Fabric canvas and connects it to the store. The CanvasController
 * instance is lifted into `controllerRef` so the toolbar and panels can drive
 * it. This component owns nothing about the design content itself.
 */
export default function CanvasStage({
  project,
  controllerRef,
  fitRef,
  onContextMenu,
  initialPageId,
  initialPageJson,
  initialPageWidth,
  initialPageHeight,
}) {
  const canvasElRef = useRef(null);
  const workspaceRef = useRef(null);
  const outerRef = useRef(null);
  const artboardRef = useRef(null);
  const showRulers = useEditorStore((s) => s.showRulers);
  // Keep the latest context-menu callback reachable from the controller, which
  // is created once on mount.
  const onContextMenuRef = useRef(onContextMenu);
  onContextMenuRef.current = onContextMenu;

  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;

    const controller = new CanvasController(el, {
      width: initialPageWidth ?? project.width,
      height: initialPageHeight ?? project.height,
      snapEnabled: useEditorStore.getState().snapEnabled,
      callbacks: {
        onSelection: (meta) => useEditorStore.getState().setSelection(meta),
        onLayers: (layers) => useEditorStore.getState().setLayers(layers),
        onHistory: (h) => useEditorStore.getState().setHistoryState(h),
        onZoom: (z) => useEditorStore.getState().setZoom(z),
        onDirty: () => useEditorStore.getState().markDirty(),
        onContextMenu: (m) => onContextMenuRef.current?.(m),
        onPageBackground: (c) => useEditorStore.getState().setPageBackground(c),
        onPageSize: (s) => useEditorStore.getState().setPageSize(s),
      },
    });
    controllerRef.current = controller;

    // Development-only handle for manual inspection / automated testing.
    if (process.env.NODE_ENV !== "production") {
      window.__ds = controller;
    }

    // Expose a "fit to screen" action to the toolbar (which has no workspace ref).
    if (fitRef) {
      fitRef.current = () => {
        const ws = workspaceRef.current;
        if (ws) controller.zoomToFit(ws.clientWidth, ws.clientHeight);
      };
    }

    let cancelled = false;
    (async () => {
      try {
        await controller.loadPage(initialPageId, initialPageJson, {
          width: initialPageWidth ?? project.width,
          height: initialPageHeight ?? project.height,
        });
      } catch (err) {
        console.error("Failed to load project JSON:", err);
        if (!cancelled) {
          useEditorStore
            .getState()
            .setLoadError("This project could not be opened. It may be corrupted.");
        }
      }
      if (cancelled) return;
      const ws = workspaceRef.current;
      if (ws) {
        controller.zoomToFit(ws.clientWidth, ws.clientHeight);
      }
      // Loading is not a user edit.
      useEditorStore.getState().setDirty(false);
      useEditorStore.getState().setCanvasReady(true);
    })();

    return () => {
      cancelled = true;
      controller.dispose();
      controllerRef.current = null;
      if (fitRef) fitRef.current = null;
      useEditorStore.getState().setCanvasReady(false);
      useEditorStore.getState().setSelection(null);
    };
    // Re-run only if the project identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Ctrl/Cmd + wheel to zoom; plain wheel scrolls the workspace normally.
  function handleWheel(e) {
    const controller = controllerRef.current;
    if (!controller) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) controller.zoomIn();
      else controller.zoomOut();
    }
  }

  return (
    <div ref={outerRef} className="relative h-full w-full overflow-hidden bg-slate-200">
      <div
        ref={workspaceRef}
        onWheel={handleWheel}
        className="ds-scroll absolute inset-0 flex items-center justify-center overflow-auto p-4 sm:p-8"
        style={showRulers ? { top: RULER, left: RULER } : undefined}
      >
        {/* Shadowed artboard frame; the <canvas> element sits inside. */}
        <div ref={artboardRef} className="shrink-0 shadow-2xl ring-1 ring-black/10">
          <canvas ref={canvasElRef} />
        </div>
      </div>
      {showRulers && (
        <Rulers outerRef={outerRef} artboardRef={artboardRef} workspaceRef={workspaceRef} />
      )}
    </div>
  );
}
