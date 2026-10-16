import {
  Canvas,
  IText,
  Rect,
  Circle,
  Triangle,
  Line,
  FabricImage,
  Group,
  ActiveSelection,
  FabricObject,
} from "fabric";
import { HistoryManager } from "@/lib/history/history";

/**
 * CanvasController wraps a single Fabric.js canvas and is the ONLY place that
 * talks to Fabric. React components call its methods; it pushes UI updates back
 * out through the callbacks passed to the constructor. This keeps the canvas
 * lifecycle, history, and editing operations isolated and reusable.
 *
 * Coordinate model: the Fabric canvas is kept at the artboard's intrinsic size
 * (e.g. 1280x720). Zoom is applied with setZoom + setDimensions so the backing
 * store always matches the artboard and PNG export is pixel-exact.
 */

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const COMMIT_DEBOUNCE_MS = 300;
const SNAP_TOLERANCE_PX = 6; // snap distance in screen pixels
const GUIDE_COLOR = "#ec4899";

const DEFAULT_SHAPE = {
  fill: "#6366f1",
  stroke: "#1e1b4b",
  strokeWidth: 0,
};

// Extra properties serialized on every object so IDs, layer names, lock state
// and visibility survive toJSON()/loadFromJSON() (and therefore Dexie + undo).
// `visible` is already serialized by Fabric's defaults.
FabricObject.customProperties = [
  "id",
  "name",
  "selectable",
  "evented",
  "lockMovementX",
  "lockMovementY",
  "lockScalingX",
  "lockScalingY",
  "lockRotation",
  "hasControls",
];

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `o_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const LOCK_PROPS = {
  locked: {
    selectable: false,
    evented: false,
    lockMovementX: true,
    lockMovementY: true,
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
    hasControls: false,
  },
  unlocked: {
    selectable: true,
    evented: true,
    lockMovementX: false,
    lockMovementY: false,
    lockScalingX: false,
    lockScalingY: false,
    lockRotation: false,
    hasControls: true,
  },
};

export class CanvasController {
  constructor(canvasEl, { width, height, callbacks = {}, snapEnabled = true } = {}) {
    this.width = width;
    this.height = height;
    this.callbacks = callbacks;
    this.zoom = 1;
    this.snapEnabled = snapEnabled;
    this._commitTimer = null;
    this._disposed = false;
    this._guides = [];

    this.canvas = new Canvas(canvasEl, {
      width,
      height,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
      selection: true,
      controlsAboveOverlay: true,
      // Emit a mouse:down for right-clicks and suppress the native browser menu
      // so we can show our own context menu.
      fireRightClick: true,
      stopContextMenu: true,
    });

    // Per-page undo/redo isolation: one HistoryManager per page id, swapped by
    // loadPage(). `this.history` always points at the active page's manager.
    this.pageHistories = new Map();
    this.activePageId = null;
    this.history = new HistoryManager({
      onChange: (state) => this.callbacks.onHistory?.(state),
    });

    this._wireEvents();
    this.history.reset(this._snapshot());
  }

  /* ----------------------------- events ------------------------------ */

  _wireEvents() {
    const sync = () => this._sync();
    this.canvas.on("selection:created", sync);
    this.canvas.on("selection:updated", sync);
    this.canvas.on("selection:cleared", sync);

    this.canvas.on("object:modified", () => {
      this._emitSelection();
      this._commit();
    });
    this.canvas.on("object:added", () => {
      this._sync();
      this._commitNow();
    });
    this.canvas.on("object:removed", () => {
      this._sync();
      this._commitNow();
    });
    this.canvas.on("text:changed", () => {
      this._emitSelection();
      this._commit();
    });

    // Smart guides / snapping.
    this.canvas.on("object:moving", (e) => this._onObjectMoving(e));
    this.canvas.on("mouse:up", () => this._clearGuides());
    this.canvas.on("after:render", () => this._drawGuides());

    // Right-click: select the object under the pointer (if any) and ask the UI
    // to open the context menu. Fabric already computed the target for us.
    this.canvas.on("mouse:down", (opt) => {
      if (!opt.e || opt.e.button !== 2) return;
      const target = opt.target;
      if (target && target.selectable !== false) {
        this.canvas.setActiveObject(target);
      } else {
        this.canvas.discardActiveObject();
      }
      this.canvas.requestRenderAll();
      this._sync();
      this.callbacks.onContextMenu?.({
        x: opt.e.clientX,
        y: opt.e.clientY,
        hasTarget: !!(target && target.selectable !== false),
      });
    });
  }

  /** Emit selection meta, the layer list, the page background and size. */
  _sync() {
    this._emitSelection();
    this._emitLayers();
    this._emitPageBackground();
    this._emitPageSize();
  }

  _emitPageBackground() {
    this.callbacks.onPageBackground?.(this.getPageBackground());
  }

  _emitPageSize() {
    this.callbacks.onPageSize?.({ width: this.width, height: this.height });
  }

  _emitSelection() {
    const obj = this.canvas.getActiveObject();
    this.callbacks.onSelection?.(obj ? this._selectionMeta(obj) : null);
  }

  _selectionMeta(obj) {
    const isText = obj instanceof IText;
    const isMultiple = obj instanceof ActiveSelection;
    return {
      id: obj.id,
      name: obj.name,
      type: obj.type,
      isText,
      isMultiple,
      isGroup: obj instanceof Group && !isMultiple,
      isRect: obj instanceof Rect,
      isImage: obj instanceof FabricImage,
      locked: obj.selectable === false,
      fill: typeof obj.fill === "string" ? obj.fill : "#000000",
      stroke: typeof obj.stroke === "string" ? obj.stroke : "#000000",
      strokeWidth: obj.strokeWidth ?? 0,
      opacity: obj.opacity ?? 1,
      angle: Math.round(obj.angle ?? 0),
      left: Math.round(obj.left ?? 0),
      top: Math.round(obj.top ?? 0),
      rx: obj.rx ?? 0,
      text: isText ? obj.text : undefined,
      fontSize: isText ? obj.fontSize : undefined,
      fontFamily: isText ? obj.fontFamily : undefined,
      fontWeight: isText ? obj.fontWeight : undefined,
      fontStyle: isText ? obj.fontStyle : undefined,
      underline: isText ? obj.underline : undefined,
      textAlign: isText ? obj.textAlign : undefined,
    };
  }

  _emitLayers() {
    const activeIds = new Set(this.canvas.getActiveObjects().map((o) => o.id));
    // Canvas order is bottom-first; the panel shows top-most first.
    const layers = this.canvas
      .getObjects()
      .map((o) => ({
        id: o.id,
        name: o.name || o.type,
        type: o.type,
        visible: o.visible !== false,
        locked: o.selectable === false,
        selected: activeIds.has(o.id),
      }))
      .reverse();
    this.callbacks.onLayers?.(layers);
  }

  /* ---------------------------- identity ----------------------------- */

  _assignIdentity(obj, name) {
    if (!obj.id) obj.id = newId();
    if (!obj.name) obj.name = name;
    return obj;
  }

  _findById(id) {
    return this.canvas.getObjects().find((o) => o.id === id);
  }

  /* ---------------------------- history ------------------------------ */

  _snapshot() {
    return JSON.stringify(this.canvas.toJSON());
  }

  _commit() {
    if (this.history.locked || this._disposed) return;
    this.callbacks.onDirty?.();
    clearTimeout(this._commitTimer);
    this._commitTimer = setTimeout(() => {
      if (this._disposed) return;
      this.history.record(this._snapshot());
    }, COMMIT_DEBOUNCE_MS);
  }

  _commitNow() {
    if (this.history.locked || this._disposed) return;
    this.callbacks.onDirty?.();
    clearTimeout(this._commitTimer);
    this.history.record(this._snapshot());
  }

  /**
   * Run a compound mutation (group, ungroup, multi-delete) as a single undo
   * step. Intermediate object:added/removed events would otherwise each record
   * their own snapshot, so we suppress commits during `fn` and record once.
   */
  _atomic(fn) {
    const wasLocked = this.history.locked;
    this.history.locked = true;
    try {
      fn();
    } finally {
      this.history.locked = wasLocked;
    }
    if (!wasLocked) this._commitNow();
  }

  async _applySnapshot(snapshot) {
    if (snapshot == null) return;
    this.history.locked = true;
    try {
      await this.canvas.loadFromJSON(snapshot);
      this.canvas.requestRenderAll();
    } finally {
      this.history.locked = false;
    }
    this._sync();
    this.callbacks.onDirty?.();
  }

  async undo() {
    await this._applySnapshot(this.history.undo());
  }

  async redo() {
    await this._applySnapshot(this.history.redo());
  }

  /* --------------------------- add objects --------------------------- */

  _centerAndSelect(obj, name) {
    this._assignIdentity(obj, name);
    this.canvas.add(obj);
    this.canvas.viewportCenterObject(obj);
    obj.setCoords();
    this.canvas.setActiveObject(obj);
    this.canvas.requestRenderAll();
    this._sync();
  }

  addText(initial = "Double-click to edit") {
    const text = new IText(initial, {
      left: this.width / 2,
      top: this.height / 2,
      originX: "center",
      originY: "center",
      fontFamily: "Inter, sans-serif",
      fontSize: 64,
      fill: "#0f172a",
      fontWeight: "700",
      textAlign: "center",
    });
    this._centerAndSelect(text, "Text");
    return text;
  }

  addRect() {
    const rect = new Rect({ width: 320, height: 200, rx: 0, ry: 0, ...DEFAULT_SHAPE });
    this._centerAndSelect(rect, "Rectangle");
    return rect;
  }

  addCircle() {
    const circle = new Circle({ radius: 120, ...DEFAULT_SHAPE });
    this._centerAndSelect(circle, "Circle");
    return circle;
  }

  addTriangle() {
    const tri = new Triangle({ width: 240, height: 220, ...DEFAULT_SHAPE });
    this._centerAndSelect(tri, "Triangle");
    return tri;
  }

  addLine() {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const line = new Line([cx - 160, cy, cx + 160, cy], {
      stroke: "#1e1b4b",
      strokeWidth: 8,
      strokeLineCap: "round",
    });
    this._centerAndSelect(line, "Line");
    return line;
  }

  addImageFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type?.startsWith("image/")) {
        reject(new Error("Please choose a valid image file."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read the image file."));
      reader.onload = async () => {
        try {
          const img = await FabricImage.fromURL(String(reader.result));
          const maxW = this.width * 0.7;
          const maxH = this.height * 0.7;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          img.scale(scale);
          this._centerAndSelect(img, "Image");
          resolve(img);
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Failed to load image."));
        }
      };
      reader.readAsDataURL(file);
    });
  }

  /* --------------------- edit / arrange selection -------------------- */

  getActive() {
    return this.canvas.getActiveObject();
  }

  setActiveProp(key, value) {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    obj.set(key, value);
    if (key === "fontSize" || key === "fontFamily" || key === "fontWeight") {
      obj.initDimensions?.();
    }
    obj.setCoords();
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  deleteActive() {
    const objects = this.canvas.getActiveObjects();
    if (!objects.length) return;
    this._atomic(() => {
      objects.forEach((o) => this.canvas.remove(o));
      this.canvas.discardActiveObject();
    });
    this.canvas.requestRenderAll();
    this._sync();
  }

  duplicateActive() {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    obj.clone().then((clone) => {
      clone.set({ left: (obj.left ?? 0) + 24, top: (obj.top ?? 0) + 24 });
      clone.id = undefined;
      clone.name = undefined;
      this._assignIdentity(clone, (obj.name || obj.type) + " copy");
      this.canvas.discardActiveObject();
      this.canvas.add(clone);
      this.canvas.setActiveObject(clone);
      this.canvas.requestRenderAll();
      this._sync();
    });
  }

  /** Nudge the active object(s) by (dx, dy) scene pixels. */
  nudge(dx, dy) {
    const obj = this.canvas.getActiveObject();
    if (!obj || obj.selectable === false) return;
    obj.set({ left: (obj.left ?? 0) + dx, top: (obj.top ?? 0) + dy });
    obj.setCoords();
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  selectAll() {
    const objs = this.canvas
      .getObjects()
      .filter((o) => o.selectable !== false && o.visible !== false);
    if (!objs.length) return;
    this.canvas.discardActiveObject();
    if (objs.length === 1) {
      this.canvas.setActiveObject(objs[0]);
    } else {
      const sel = new ActiveSelection(objs, { canvas: this.canvas });
      this.canvas.setActiveObject(sel);
    }
    this.canvas.requestRenderAll();
    this._sync();
  }

  deselect() {
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this._sync();
  }

  /* --------------------------- z-order ------------------------------- */

  bringForward() {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    this.canvas.bringObjectForward(obj);
    this.canvas.requestRenderAll();
    this._sync();
    this._commitNow();
  }

  sendBackward() {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    this.canvas.sendObjectBackwards(obj);
    this.canvas.requestRenderAll();
    this._sync();
    this._commitNow();
  }

  bringToFront() {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    this.canvas.bringObjectToFront(obj);
    this.canvas.requestRenderAll();
    this._sync();
    this._commitNow();
  }

  sendToBack() {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    this.canvas.sendObjectToBack(obj);
    this.canvas.requestRenderAll();
    this._sync();
    this._commitNow();
  }

  /* ----------------------- layer panel ops --------------------------- */

  selectById(id) {
    const obj = this._findById(id);
    if (!obj || obj.selectable === false) return;
    this.canvas.discardActiveObject();
    this.canvas.setActiveObject(obj);
    this.canvas.requestRenderAll();
    this._sync();
  }

  toggleVisibility(id) {
    const obj = this._findById(id);
    if (!obj) return;
    const nextVisible = obj.visible === false;
    obj.visible = nextVisible;
    if (!nextVisible && this.canvas.getActiveObject() === obj) {
      this.canvas.discardActiveObject();
    }
    this.canvas.requestRenderAll();
    this._sync();
    this._commitNow();
  }

  toggleLock(id) {
    const obj = this._findById(id);
    if (!obj) return;
    const willLock = obj.selectable !== false;
    obj.set(willLock ? LOCK_PROPS.locked : LOCK_PROPS.unlocked);
    if (willLock && this.canvas.getActiveObject() === obj) {
      this.canvas.discardActiveObject();
    }
    obj.setCoords();
    this.canvas.requestRenderAll();
    this._sync();
    this._commitNow();
  }

  renameLayer(id, name) {
    const obj = this._findById(id);
    if (!obj) return;
    obj.name = name;
    this._sync();
    this._commit();
  }

  /** Move a layer up (toward front) or down (toward back) by one step. */
  moveLayer(id, direction) {
    const obj = this._findById(id);
    if (!obj) return;
    if (direction === "up") this.canvas.bringObjectForward(obj);
    else this.canvas.sendObjectBackwards(obj);
    this.canvas.requestRenderAll();
    this._sync();
    this._commitNow();
  }

  /** Move a layer to an explicit canvas index (0 = back). */
  moveLayerToIndex(id, index) {
    const obj = this._findById(id);
    if (!obj) return;
    this.canvas.moveObjectTo(obj, index);
    this.canvas.requestRenderAll();
    this._sync();
    this._commitNow();
  }

  deleteById(id) {
    const obj = this._findById(id);
    if (!obj) return;
    if (this.canvas.getActiveObject() === obj) this.canvas.discardActiveObject();
    this.canvas.remove(obj);
    this.canvas.requestRenderAll();
    this._sync();
  }

  /* --------------------------- group / ungroup ----------------------- */

  group() {
    const active = this.canvas.getActiveObject();
    if (!(active instanceof ActiveSelection)) return null;
    const objects = active.getObjects();
    if (objects.length < 2) return null;
    let grp = null;
    this._atomic(() => {
      this.canvas.discardActiveObject();
      this.canvas.remove(...objects);
      grp = new Group(objects);
      this._assignIdentity(grp, "Group");
      this.canvas.add(grp);
      this.canvas.setActiveObject(grp);
    });
    this.canvas.requestRenderAll();
    this._sync();
    return grp;
  }

  ungroup() {
    const grp = this.canvas.getActiveObject();
    if (!(grp instanceof Group) || grp instanceof ActiveSelection) return null;
    let objects = [];
    this._atomic(() => {
      objects = grp.removeAll();
      this.canvas.remove(grp);
      objects.forEach((o) => {
        this._assignIdentity(o, o.type);
        this.canvas.add(o);
      });
      const sel = new ActiveSelection(objects, { canvas: this.canvas });
      this.canvas.setActiveObject(sel);
    });
    this.canvas.requestRenderAll();
    this._sync();
    return objects;
  }

  /* ----------------------- align / distribute ------------------------ */

  _alignDelta(box, target, mode) {
    switch (mode) {
      case "left":
        return { dx: target.left - box.left, dy: 0 };
      case "center-h":
        return {
          dx: target.left + target.width / 2 - (box.left + box.width / 2),
          dy: 0,
        };
      case "right":
        return {
          dx: target.left + target.width - (box.left + box.width),
          dy: 0,
        };
      case "top":
        return { dx: 0, dy: target.top - box.top };
      case "middle-v":
        return {
          dx: 0,
          dy: target.top + target.height / 2 - (box.top + box.height / 2),
        };
      case "bottom":
        return {
          dx: 0,
          dy: target.top + target.height - (box.top + box.height),
        };
      default:
        return { dx: 0, dy: 0 };
    }
  }

  align(mode) {
    const active = this.canvas.getActiveObject();
    if (!active) return;

    if (active instanceof ActiveSelection) {
      // Align each child within the selection's bounding box. Discarding the
      // selection first converts children to absolute scene coordinates, which
      // keeps the geometry simple; then we re-select them.
      const target = active.getBoundingRect();
      const objects = active.getObjects();
      this.canvas.discardActiveObject();
      objects.forEach((o) => {
        const { dx, dy } = this._alignDelta(o.getBoundingRect(), target, mode);
        o.set({ left: (o.left ?? 0) + dx, top: (o.top ?? 0) + dy });
        o.setCoords();
      });
      const sel = new ActiveSelection(objects, { canvas: this.canvas });
      this.canvas.setActiveObject(sel);
    } else {
      // Single object aligns to the page.
      const target = { left: 0, top: 0, width: this.width, height: this.height };
      const { dx, dy } = this._alignDelta(active.getBoundingRect(), target, mode);
      active.set({ left: (active.left ?? 0) + dx, top: (active.top ?? 0) + dy });
      active.setCoords();
    }
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commitNow();
  }

  /** Evenly distribute 3+ selected objects along an axis ('h' or 'v'). */
  distribute(axis) {
    const active = this.canvas.getActiveObject();
    if (!(active instanceof ActiveSelection)) return;
    const objects = active.getObjects();
    if (objects.length < 3) return;

    this.canvas.discardActiveObject();
    const entries = objects.map((o) => ({ o, box: o.getBoundingRect() }));
    const isH = axis === "h";
    const centerOf = (b) => (isH ? b.left + b.width / 2 : b.top + b.height / 2);
    entries.sort((a, b) => centerOf(a.box) - centerOf(b.box));

    const first = centerOf(entries[0].box);
    const last = centerOf(entries[entries.length - 1].box);
    const step = (last - first) / (entries.length - 1);

    entries.forEach((entry, i) => {
      if (i === 0 || i === entries.length - 1) return;
      const targetCenter = first + step * i;
      const delta = targetCenter - centerOf(entry.box);
      entry.o.set(
        isH
          ? { left: (entry.o.left ?? 0) + delta }
          : { top: (entry.o.top ?? 0) + delta }
      );
      entry.o.setCoords();
    });

    const sel = new ActiveSelection(objects, { canvas: this.canvas });
    this.canvas.setActiveObject(sel);
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commitNow();
  }

  /* --------------------------- snapping ------------------------------ */

  setSnapEnabled(enabled) {
    this.snapEnabled = enabled;
    if (!enabled) this._clearGuides();
  }

  _onObjectMoving(e) {
    if (!this.snapEnabled) return;
    const obj = e.target;
    if (!obj) return;
    const tol = SNAP_TOLERANCE_PX / this.zoom;
    const b = obj.getBoundingRect();

    const movingV = [b.left, b.left + b.width / 2, b.left + b.width];
    const movingH = [b.top, b.top + b.height / 2, b.top + b.height];

    const vTargets = [0, this.width / 2, this.width];
    const hTargets = [0, this.height / 2, this.height];
    for (const o of this.canvas.getObjects()) {
      if (o === obj || o.visible === false) continue;
      const ob = o.getBoundingRect();
      vTargets.push(ob.left, ob.left + ob.width / 2, ob.left + ob.width);
      hTargets.push(ob.top, ob.top + ob.height / 2, ob.top + ob.height);
    }

    const best = (moving, targets) => {
      let delta = 0;
      let line = null;
      let min = tol;
      for (const m of moving) {
        for (const t of targets) {
          const d = Math.abs(t - m);
          if (d <= min) {
            min = d;
            delta = t - m;
            line = t;
          }
        }
      }
      return { delta, line };
    };

    const x = best(movingV, vTargets);
    const y = best(movingH, hTargets);

    this._guides = [];
    if (x.line !== null) {
      obj.set("left", (obj.left ?? 0) + x.delta);
      this._guides.push({ x1: x.line, y1: 0, x2: x.line, y2: this.height });
    }
    if (y.line !== null) {
      obj.set("top", (obj.top ?? 0) + y.delta);
      this._guides.push({ x1: 0, y1: y.line, x2: this.width, y2: y.line });
    }
    if (x.line !== null || y.line !== null) obj.setCoords();
  }

  _clearGuides() {
    if (this._guides.length) {
      this._guides = [];
      this.canvas.requestRenderAll();
    }
  }

  _drawGuides() {
    if (!this._guides.length) return;
    const ctx = this.canvas.getContext();
    const vpt = this.canvas.viewportTransform;
    ctx.save();
    ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
    ctx.strokeStyle = GUIDE_COLOR;
    ctx.lineWidth = 1 / this.zoom;
    for (const g of this._guides) {
      ctx.beginPath();
      ctx.moveTo(g.x1, g.y1);
      ctx.lineTo(g.x2, g.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------ zoom ------------------------------- */

  getZoom() {
    return this.zoom;
  }

  setZoom(z) {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    this.zoom = clamped;
    this.canvas.setZoom(clamped);
    this.canvas.setDimensions({
      width: Math.round(this.width * clamped),
      height: Math.round(this.height * clamped),
    });
    this.canvas.requestRenderAll();
    this.callbacks.onZoom?.(clamped);
  }

  zoomIn() {
    this.setZoom(this.zoom * 1.2);
  }

  zoomOut() {
    this.setZoom(this.zoom / 1.2);
  }

  zoomToFit(containerW, containerH, padding = 48) {
    const z = Math.min(
      (containerW - padding) / this.width,
      (containerH - padding) / this.height
    );
    this.setZoom(z > 0 ? z : 1);
  }

  /* ------------------------ export / persistence --------------------- */

  exportPNG() {
    const z = this.zoom;
    this.canvas.discardActiveObject();
    this.canvas.setZoom(1);
    this.canvas.setDimensions({ width: this.width, height: this.height });
    const url = this.canvas.toDataURL({ format: "png", multiplier: 1 });
    this.setZoom(z);
    this.canvas.requestRenderAll();
    return url;
  }

  getThumbnail(targetWidth = 320) {
    const z = this.zoom;
    this.canvas.setZoom(1);
    this.canvas.setDimensions({ width: this.width, height: this.height });
    const url = this.canvas.toDataURL({
      format: "png",
      multiplier: targetWidth / this.width,
    });
    this.setZoom(z);
    return url;
  }

  toJSON() {
    return this._snapshot();
  }

  /* ----------------------------- pages ------------------------------- */

  getActivePageId() {
    return this.activePageId;
  }

  getPageBackground() {
    const bg = this.canvas.backgroundColor;
    return typeof bg === "string" ? bg : "#ffffff";
  }

  setPageBackground(color) {
    this.canvas.backgroundColor = color;
    this.canvas.requestRenderAll();
    this._emitPageBackground();
    this._commitNow();
  }

  getPageSize() {
    return { width: this.width, height: this.height };
  }

  /**
   * Resize the active page's artboard. Dimensions live in the page model (not
   * the Fabric JSON), so this does not record a history snapshot; objects keep
   * their coordinates. The caller persists the new size and re-fits the view.
   */
  setPageDimensions(width, height) {
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    this.setZoom(this.zoom);
    this._emitPageSize();
    this.canvas.requestRenderAll();
  }

  /**
   * Load a page's canvas content and switch to that page's isolated history.
   * Loading never records onto the outgoing page's history. `json` may be
   * null/undefined for a blank page. `dims` (optional) sets the artboard size
   * for this page — dimensions are per-page, not stored in the Fabric JSON.
   */
  async loadPage(pageId, json, dims) {
    // Apply the page's dimensions FIRST (synchronously) so callers can re-fit
    // immediately, before the async content load resolves.
    if (dims && dims.width && dims.height) {
      this.width = dims.width;
      this.height = dims.height;
      this.setZoom(this.zoom);
      this._emitPageSize();
    }
    const prev = this.history;
    if (prev) prev.locked = true;
    try {
      if (json) {
        await this.canvas.loadFromJSON(json);
        // Backfill identity for documents saved before IDs existed (M1).
        this.canvas.getObjects().forEach((o) => this._assignIdentity(o, o.type));
      } else {
        this.canvas.remove(...this.canvas.getObjects());
        this.canvas.backgroundColor = "#ffffff";
        this.canvas.discardActiveObject();
      }
      this.canvas.requestRenderAll();
    } finally {
      if (prev) prev.locked = false;
    }

    this.activePageId = pageId;
    let hm = this.pageHistories.get(pageId);
    if (!hm) {
      hm = new HistoryManager({
        onChange: (state) => this.callbacks.onHistory?.(state),
      });
      this.pageHistories.set(pageId, hm);
      this.history = hm;
      hm.reset(this._snapshot());
    } else {
      // Returning to a page we've visited: keep its existing undo stack.
      this.history = hm;
      hm.notify();
    }
    this._sync();
  }

  /** Forget a deleted page's history so it can't be undone back into. */
  dropPageHistory(pageId) {
    this.pageHistories.delete(pageId);
  }

  /* ----------------------------- teardown ---------------------------- */

  dispose() {
    this._disposed = true;
    clearTimeout(this._commitTimer);
    try {
      this.canvas.dispose();
    } catch {
      /* canvas may already be detached during fast refresh */
    }
  }
}
