import { create } from "zustand";

/**
 * UI / selection state for the editor.
 *
 * This store deliberately does NOT own canvas objects — Fabric.js is the single
 * source of truth for the design itself. The store mirrors just enough to drive
 * the React UI: which tool is active, the current zoom, a serializable snapshot
 * of the selected object's properties (so the Properties panel can render
 * controls), save status, and undo/redo availability.
 *
 * The CanvasController pushes updates into this store via the setters below.
 */

const initialSelection = null;

export const useEditorStore = create((set) => ({
  // Project meta
  projectId: null,
  projectName: "",
  projectType: "youtube-thumbnail",

  // Canvas lifecycle
  canvasReady: false,
  loadError: null,

  // Interaction
  activeTool: "select",
  zoom: 1,

  // Selected object's mirrored properties (null when nothing is selected)
  selection: initialSelection,

  // Mirror of the canvas object list for the Layers panel (top-most first).
  layers: [],

  // Smart-guide snapping toggle.
  snapEnabled: true,
  // Canvas rulers (view aid).
  showRulers: false,
  // Design grid overlay + snap-to-grid (view aid).
  showGrid: false,
  gridSize: 50,

  // Active page's background colour and size (mirrored from the controller).
  pageBackground: "#ffffff",
  pageSize: { width: 1280, height: 720 },

  // History
  canUndo: false,
  canRedo: false,

  // Persistence
  isSaving: false,
  isDirty: false,
  lastSavedAt: null,
  // Automatic cloud-sync status for the signed-in owner: "idle" (nothing to
  // report / local-only), "saving", "saved", "offline", "failed".
  cloudStatus: "idle",
  // Increments on every canvas change; autosave debounces on this so that
  // continuous edits keep resetting the timer (a plain boolean would not).
  rev: 0,

  // Mobile panel visibility
  mobilePanel: null, // 'elements' | 'properties' | null

  setProject: ({ id, name, type }) =>
    set((s) => ({
      projectId: id ?? s.projectId,
      projectName: name ?? s.projectName,
      projectType: type ?? s.projectType,
    })),
  setProjectName: (projectName) => set({ projectName }),
  setCanvasReady: (canvasReady) => set({ canvasReady }),
  setLoadError: (loadError) => set({ loadError }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setZoom: (zoom) => set({ zoom }),
  setSelection: (selection) => set({ selection }),
  setLayers: (layers) => set({ layers }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setShowRulers: (showRulers) => set({ showRulers }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setGridSize: (gridSize) => set({ gridSize }),
  setPageBackground: (pageBackground) => set({ pageBackground }),
  setPageSize: (pageSize) => set({ pageSize }),
  setHistoryState: ({ canUndo, canRedo }) => set({ canUndo, canRedo }),
  setSaving: (isSaving) => set({ isSaving }),
  setDirty: (isDirty) => set({ isDirty }),
  markDirty: () => set((s) => ({ isDirty: true, rev: s.rev + 1 })),
  markSaved: () => set({ isSaving: false, isDirty: false, lastSavedAt: Date.now() }),
  setCloudStatus: (cloudStatus) => set({ cloudStatus }),
  setMobilePanel: (mobilePanel) => set({ mobilePanel }),

  reset: () =>
    set({
      projectId: null,
      projectName: "",
      canvasReady: false,
      loadError: null,
      activeTool: "select",
      zoom: 1,
      selection: initialSelection,
      layers: [],
      canUndo: false,
      canRedo: false,
      isSaving: false,
      isDirty: false,
      lastSavedAt: null,
      cloudStatus: "idle",
      rev: 0,
      mobilePanel: null,
    }),
}));
