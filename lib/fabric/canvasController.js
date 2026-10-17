import {
  Canvas,
  StaticCanvas,
  IText,
  Textbox,
  Rect,
  Circle,
  Triangle,
  Line,
  FabricImage,
  Group,
  ActiveSelection,
  FabricObject,
  Shadow,
  Polygon,
  Path,
  Gradient,
  Pattern,
  filters as fabricFilters,
  util as fabricUtil,
} from "fabric";
import { HistoryManager } from "@/lib/history/history";
import { FONTS } from "@/lib/fonts";

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
const USER_GUIDE_COLOR = "#06b6d4";
// Default duotone pair: deep indigo shadows lifted to a pale indigo highlight.
const DUOTONE_DEFAULT = { shadow: "#1e1b4b", highlight: "#e0e7ff" };
// Design grid: spacing in canvas px and a faint slate line color.
const GRID_SIZE = 50;
const GRID_COLOR = "rgba(100,116,139,0.18)";
// Default categorical palette for charts.
const CHART_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#06b6d4",
  "#8b5cf6", "#ef4444", "#3b82f6", "#14b8a6", "#f97316",
];

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
  // Fill metadata so the UI can read back a gradient/image fill (the Fabric
  // `fill` itself serializes, but reading stops/angle out of it is awkward).
  "fillType",
  "gradient",
  // Arc-text amount (-100..100); the Path itself is rebuilt from this on load.
  "curve",
  // Per-object blend mode (canvas globalCompositeOperation) so it survives saves.
  "globalCompositeOperation",
  // Entrance animation for Present mode (none|fade|rise|pop|slide).
  "anim",
  // Chart spec stored on the chart group so it persists (and can be re-edited).
  "chart",
  // Table spec stored on the table group (edited via the Tables panel).
  "table",
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
    // Persistent user ruler guides, per page: Map<pageId, [{axis:'x'|'y', pos}]>.
    this._userGuidesByPage = new Map();
    this._userGuides = [];
    // When true, _drawGuides is skipped (used during export/thumbnail capture
    // so guides never bleed into PNG/JPG output).
    this._suppressGuides = false;
    // Optional design grid overlay (view aid; never exported).
    this._showGrid = false;
    this._gridSize = GRID_SIZE;

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
    this.canvas.on("object:rotating", (e) => this._onObjectRotating(e));
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
      isTable: obj instanceof Group && !!obj.table,
      table: obj instanceof Group && obj.table ? obj.table : null,
      isChart: obj instanceof Group && !!obj.chart,
      chart: obj instanceof Group && obj.chart ? obj.chart : null,
      isRect: obj instanceof Rect,
      isImage: obj instanceof FabricImage,
      locked: obj.selectable === false,
      fill: typeof obj.fill === "string" ? obj.fill : "#000000",
      fillType:
        obj.fillType ||
        (typeof obj.fill === "string" ? "solid" : obj.fill ? "gradient" : "solid"),
      gradient: obj.gradient || null,
      stroke: typeof obj.stroke === "string" ? obj.stroke : "#000000",
      strokeWidth: obj.strokeWidth ?? 0,
      opacity: obj.opacity ?? 1,
      angle: Math.round(obj.angle ?? 0),
      left: Math.round(obj.left ?? 0),
      top: Math.round(obj.top ?? 0),
      w: Math.round(obj.getScaledWidth?.() ?? obj.width ?? 0),
      h: Math.round(obj.getScaledHeight?.() ?? obj.height ?? 0),
      rx: obj.rx ?? 0,
      blendMode: obj.globalCompositeOperation || "source-over",
      anim: obj.anim || "none",
      hasShadow: !!obj.shadow,
      shadowColor:
        obj.shadow && typeof obj.shadow.color === "string"
          ? obj.shadow.color
          : "rgba(0,0,0,0.45)",
      shadowBlur: obj.shadow ? obj.shadow.blur ?? 0 : 10,
      shadowOffsetX: obj.shadow ? obj.shadow.offsetX ?? 0 : 4,
      shadowOffsetY: obj.shadow ? obj.shadow.offsetY ?? 0 : 4,
      // Image-only
      ...(obj instanceof FabricImage
        ? {
            flipX: !!obj.flipX,
            flipY: !!obj.flipY,
            maskShape: this._maskShapeOf(obj),
            ...this._readAdjustments(obj),
          }
        : {}),
      text: isText ? obj.text : undefined,
      fontSize: isText ? obj.fontSize : undefined,
      fontFamily: isText ? obj.fontFamily : undefined,
      fontWeight: isText ? obj.fontWeight : undefined,
      fontStyle: isText ? obj.fontStyle : undefined,
      underline: isText ? obj.underline : undefined,
      linethrough: isText ? obj.linethrough : undefined,
      textAlign: isText ? obj.textAlign : undefined,
      charSpacing: isText ? obj.charSpacing ?? 0 : undefined,
      lineHeight: isText ? obj.lineHeight ?? 1.16 : undefined,
      textBackgroundColor: isText ? obj.textBackgroundColor || "" : undefined,
      curve: isText ? obj.curve ?? 0 : undefined,
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

  /**
   * Add an editable text object. `opts` lets callers create presets
   * (heading/subheading/body) while keeping one code path. The result is a
   * normal IText, so selection, layers, undo/redo and autosave all apply.
   */
  addText(initial = "Double-click to edit", opts = {}) {
    const {
      fontSize = 64,
      fontWeight = "700",
      fill = "#0f172a",
      name = "Text",
      fontFamily = FONTS[0].css,
    } = opts;
    const text = new IText(initial, {
      left: this.width / 2,
      top: this.height / 2,
      originX: "center",
      originY: "center",
      fontFamily,
      fontSize,
      fill,
      fontWeight,
      textAlign: "center",
    });
    this._centerAndSelect(text, name);
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

  /** Load an image from any URL (incl. a data URL from the uploads library). */
  async addImageFromUrl(url) {
    const img = await FabricImage.fromURL(String(url), { crossOrigin: "anonymous" });
    const maxW = this.width * 0.7;
    const maxH = this.height * 0.7;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    img.scale(scale);
    this._centerAndSelect(img, "Image");
    return img;
  }

  /** Add a pre-built Fabric object (used by the Elements library). */
  addObject(obj, name = "Element") {
    if (!obj) return null;
    this._centerAndSelect(obj, name);
    return obj;
  }

  /* ------------------------------ charts ----------------------------- */

  /**
   * Build and insert a chart as an editable Fabric group (bars/lines/slices +
   * labels). The chart `spec` is stored on the group so it persists and could
   * be re-edited later. Supported types: column, bar, line, pie, donut.
   */
  addChart(spec = {}) {
    const group = this._buildChart(spec);
    if (!group) return null;
    group.chart = spec;
    this._centerAndSelect(group, "Chart");
    return group;
  }

  /** Rebuild the active chart group from a new spec, preserving transform/id. */
  rebuildActiveChart(newSpec) {
    const obj = this.canvas.getActiveObject();
    if (!obj || !obj.chart) return;
    const { left, top, scaleX, scaleY, angle } = obj;
    const id = obj.id;
    const name = obj.name;
    const group = this._buildChart(newSpec);
    if (!group) return;
    group.set({ left, top, scaleX, scaleY, angle });
    group.id = id;
    group.name = name;
    group.chart = newSpec;
    this.canvas.remove(obj);
    this.canvas.add(group);
    group.setCoords();
    this.canvas.setActiveObject(group);
    this.canvas.requestRenderAll();
    this._sync();
    this._commit();
  }

  _buildChart(spec) {
    const type = spec.type || "column";
    const data = (Array.isArray(spec.data) ? spec.data : [])
      .map((d) => ({ label: String(d.label ?? ""), value: Number(d.value) || 0 }))
      .slice(0, 12);
    if (!data.length) return null;
    const colors = Array.isArray(spec.colors) && spec.colors.length ? spec.colors : CHART_COLORS;
    const W = spec.width || 640;
    const H = spec.height || 420;
    const font = FONTS[0].css;
    const AXIS = "#cbd5e1";
    const INK = "#334155";
    const MUTED = "#64748b";
    const objs = [];

    const txt = (s, x, y, size, fill, originX = "left", extra = {}) =>
      new IText(String(s), {
        left: x, top: y, fontFamily: font, fontSize: size, fill,
        originX, originY: "top", selectable: true, editable: false, ...extra,
      });

    const titleH = spec.title ? 34 : 6;
    if (spec.title) objs.push(txt(spec.title, W / 2, 6, 20, INK, "center", { fontWeight: "700" }));

    if (type === "pie" || type === "donut") {
      const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
      const pad = 16;
      const legendW = 180;
      const area = { x: pad, y: titleH + pad, w: W - legendW - pad * 2, h: H - titleH - pad * 2 };
      const r = Math.max(10, Math.min(area.w / 2, area.h / 2));
      const cx = area.x + area.w / 2;
      const cy = area.y + area.h / 2;
      const ri = type === "donut" ? r * 0.56 : 0;
      const polar = (rad, ang) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
      let a = -Math.PI / 2;
      data.forEach((d, i) => {
        const frac = Math.max(0, d.value) / total;
        const a1 = a + frac * Math.PI * 2;
        const large = a1 - a > Math.PI ? 1 : 0;
        const [x1, y1] = polar(r, a);
        const [x2, y2] = polar(r, a1);
        let dPath;
        if (ri > 0) {
          const [ix1, iy1] = polar(ri, a);
          const [ix2, iy2] = polar(ri, a1);
          dPath = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ri} ${ri} 0 ${large} 0 ${ix1} ${iy1} Z`;
        } else {
          dPath = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
        }
        objs.push(new Path(dPath, { fill: colors[i % colors.length], stroke: "#ffffff", strokeWidth: 2, selectable: true }));
        a = a1;
      });
      // Legend.
      const lx = W - legendW + pad;
      let ly = titleH + pad;
      data.forEach((d, i) => {
        objs.push(new Rect({ left: lx, top: ly + 2, width: 12, height: 12, rx: 2, ry: 2, fill: colors[i % colors.length] }));
        const pct = Math.round((Math.max(0, d.value) / total) * 100);
        objs.push(txt(`${d.label}  ${pct}%`, lx + 18, ly, 13, INK));
        ly += 24;
      });
    } else {
      const horizontal = type === "bar";
      const maxVal = Math.max(1, ...data.map((d) => Math.abs(d.value)));
      const left = horizontal ? 96 : 52;
      const right = 16;
      const top = titleH + 8;
      const bottom = 36;
      const plotX = left;
      const plotY = top;
      const plotW = W - left - right;
      const plotH = H - top - bottom;
      const baseY = plotY + plotH;

      // Axes.
      objs.push(new Line([plotX, plotY, plotX, baseY], { stroke: AXIS, strokeWidth: 1, selectable: true }));
      objs.push(new Line([plotX, baseY, plotX + plotW, baseY], { stroke: AXIS, strokeWidth: 1, selectable: true }));
      // Gridlines + value axis labels (4 steps).
      const steps = 4;
      for (let s = 1; s <= steps; s++) {
        const v = (maxVal / steps) * s;
        if (horizontal) continue; // keep horizontal charts simpler
        const gy = baseY - (v / maxVal) * plotH;
        objs.push(new Line([plotX, gy, plotX + plotW, gy], { stroke: "#eef2f7", strokeWidth: 1, selectable: true }));
        objs.push(txt(Math.round(v), plotX - 6, gy - 7, 11, MUTED, "right"));
      }

      const n = data.length;
      if (type === "line") {
        const slot = plotW / n;
        const pts = data.map((d, i) => [plotX + slot * i + slot / 2, baseY - (Math.max(0, d.value) / maxVal) * plotH]);
        const dPath = pts.map((p, i) => `${i ? "L" : "M"} ${p[0]} ${p[1]}`).join(" ");
        objs.push(new Path(dPath, { fill: "transparent", stroke: colors[0], strokeWidth: 3, strokeLineJoin: "round", strokeLineCap: "round", selectable: true }));
        pts.forEach((p) => objs.push(new Circle({ left: p[0], top: p[1], radius: 4, fill: colors[0], originX: "center", originY: "center" })));
        data.forEach((d, i) => objs.push(txt(d.label, plotX + slot * i + slot / 2, baseY + 8, 11, MUTED, "center")));
      } else if (horizontal) {
        const slot = plotH / n;
        const barH = Math.min(36, slot * 0.62);
        data.forEach((d, i) => {
          const w = (Math.max(0, d.value) / maxVal) * plotW;
          const y = plotY + slot * i + (slot - barH) / 2;
          objs.push(new Rect({ left: plotX, top: y, width: Math.max(1, w), height: barH, rx: 3, ry: 3, fill: colors[i % colors.length] }));
          objs.push(txt(d.label, plotX - 8, y + barH / 2 - 7, 12, INK, "right"));
          objs.push(txt(d.value, plotX + w + 6, y + barH / 2 - 7, 11, MUTED, "left"));
        });
      } else {
        // Column (vertical bars).
        const slot = plotW / n;
        const barW = Math.min(64, slot * 0.6);
        data.forEach((d, i) => {
          const bh = (Math.max(0, d.value) / maxVal) * plotH;
          const x = plotX + slot * i + (slot - barW) / 2;
          const y = baseY - bh;
          objs.push(new Rect({ left: x, top: y, width: barW, height: Math.max(1, bh), rx: 3, ry: 3, fill: colors[i % colors.length] }));
          objs.push(txt(d.value, x + barW / 2, y - 16, 11, MUTED, "center"));
          objs.push(txt(d.label, x + barW / 2, baseY + 8, 11, MUTED, "center"));
        });
      }
    }

    return new Group(objs, { originX: "left", originY: "top", subTargetCheck: false });
  }

  /* ------------------------------ tables ----------------------------- */

  /** Insert a new table from a spec, as an editable group. */
  addTable(spec) {
    const group = this._buildTable(spec);
    if (!group) return null;
    group.table = spec;
    this._centerAndSelect(group, "Table");
    return group;
  }

  /**
   * Rebuild the active table group from a new spec, preserving its position,
   * scale, rotation, id and name. Used by the Tables panel for every structural
   * or cell edit so the change is one coherent, undoable step.
   */
  rebuildActiveTable(newSpec) {
    const obj = this.canvas.getActiveObject();
    if (!obj || !obj.table) return;
    const { left, top, scaleX, scaleY, angle } = obj;
    const id = obj.id;
    const name = obj.name;
    const group = this._buildTable(newSpec);
    if (!group) return;
    group.set({ left, top, scaleX, scaleY, angle });
    group.id = id;
    group.name = name;
    group.table = newSpec;
    this.canvas.remove(obj);
    this.canvas.add(group);
    group.setCoords();
    this.canvas.setActiveObject(group);
    this.canvas.requestRenderAll();
    this._sync();
    this._commit();
  }

  /** Build a table group from a spec (rows/cols/cells/colWidths/rowHeights). */
  _buildTable(spec) {
    if (!spec || !spec.rows || !spec.cols) return null;
    const rows = spec.rows;
    const cols = spec.cols;
    const colW = spec.colWidths || Array(cols).fill(120);
    const rowH = spec.rowHeights || Array(rows).fill(40);
    const border = spec.border || { color: "#cbd5e1", width: 1 };
    const font = spec.fontFamily || FONTS[0].css;
    const fontSize = spec.fontSize || 14;
    const header = !!spec.headerRow;
    const cells = spec.cells || [];
    const pad = 8;

    const xs = [0];
    for (let c = 0; c < cols; c++) xs.push(xs[c] + (colW[c] || 120));
    const ys = [0];
    for (let r = 0; r < rows; r++) ys.push(ys[r] + (rowH[r] || 40));

    const objs = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = (cells[r] && cells[r][c]) || {};
        const x = xs[c];
        const y = ys[r];
        const w = colW[c] || 120;
        const h = rowH[r] || 40;
        const isHeader = header && r === 0;
        const bg = cell.bg || (isHeader ? "#eef2ff" : "#ffffff");
        objs.push(
          new Rect({
            left: x, top: y, width: w, height: h, fill: bg,
            stroke: border.color, strokeWidth: border.width,
            originX: "left", originY: "top", selectable: true,
          })
        );
        const align = cell.align || "left";
        const bold = cell.bold || isHeader;
        const color = cell.color || (isHeader ? "#3730a3" : "#334155");
        // Wrapping text box constrained to the column width; top-aligned with
        // padding so multi-line cell content stays inside its column.
        objs.push(
          new Textbox(String(cell.text ?? ""), {
            left: x + pad, top: y + pad, width: Math.max(8, w - pad * 2),
            originX: "left", originY: "top",
            fontFamily: font, fontSize, fill: color,
            fontWeight: bold ? "700" : "400", textAlign: align,
            editable: false, selectable: true, splitByGrapheme: false,
          })
        );
      }
    }
    return new Group(objs, { originX: "left", originY: "top", subTargetCheck: false });
  }

  /* --------------------- edit / arrange selection -------------------- */

  getActive() {
    return this.canvas.getActiveObject();
  }

  setActiveProp(key, value) {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    obj.set(key, value);
    // Text outline (stroke) must paint behind the fill so the letters stay legible.
    if (obj instanceof IText && (key === "stroke" || key === "strokeWidth")) {
      // Paint the outline behind the fill and round the joins/caps so the
      // text outline stays smooth instead of spiky at corners.
      obj.set({ paintFirst: "stroke", strokeLineJoin: "round", strokeLineCap: "round" });
    }
    const metricsKey =
      key === "fontSize" ||
      key === "fontFamily" ||
      key === "fontWeight" ||
      key === "fontStyle" ||
      key === "charSpacing" ||
      key === "text";
    if (metricsKey) obj.initDimensions?.();
    // A curved text's arc is sized to its width, so refit it when the width
    // could have changed (font, size, spacing, or the text itself).
    if (metricsKey && obj instanceof IText && obj.curve) this._applyCurve(obj);
    obj.setCoords();
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  /**
   * Resize the active object to an absolute display size in canvas pixels by
   * adjusting scale (keeps geometry/quality). `dim` is "w" or "h"; when `lock`
   * is set the other dimension scales by the same ratio to preserve aspect.
   */
  setActiveDimension(dim, value, lock = false) {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    const v = Math.max(1, Number(value) || 1);
    const curW = obj.getScaledWidth();
    const curH = obj.getScaledHeight();
    if (dim === "w") {
      const r = v / (curW || 1);
      obj.scaleX = (obj.scaleX || 1) * r;
      if (lock) obj.scaleY = (obj.scaleY || 1) * r;
    } else {
      const r = v / (curH || 1);
      obj.scaleY = (obj.scaleY || 1) * r;
      if (lock) obj.scaleX = (obj.scaleX || 1) * r;
    }
    obj.setCoords();
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  /* ------------------------------ text ------------------------------- */

  async _loadFont(css, weight = "400") {
    if (typeof document === "undefined" || !document.fonts) return;
    const fam = String(css).split(",")[0].trim();
    if (!fam) return;
    try {
      await document.fonts.load(`${weight || 400} 40px ${fam}`);
    } catch {
      /* font may still render via swap */
    }
  }

  /** Load a font before applying it so the text measures and renders correctly. */
  async setActiveFont(css) {
    const obj = this.canvas.getActiveObject();
    if (!obj || !(obj instanceof IText)) return;
    await this._loadFont(css, obj.fontWeight);
    obj.set("fontFamily", css);
    obj.initDimensions?.();
    if (obj.curve) this._applyCurve(obj);
    obj.setCoords();
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  /**
   * Rebuild (or clear) the arc Path a curved IText rides on, from its stored
   * `curve` amount (-100..100). Pure: mutates the object but does not render,
   * emit, or commit — callers do that. The straight width is measured with the
   * path removed so the arc length always matches the real text width.
   */
  _applyCurve(obj) {
    if (!(obj instanceof IText)) return;
    const amt = Math.max(-100, Math.min(100, Number(obj.curve) || 0));
    if (obj.path) {
      obj.set("path", null);
      obj.initDimensions?.();
    }
    if (!amt) {
      obj.curve = 0;
      obj.setCoords();
      return;
    }
    const w = Math.max(1, obj.width);
    // Total sweep angle grows with |amt|, capped below a full semicircle so the
    // arc never folds back on itself. Radius = arc length / angle keeps length = w.
    const A = (Math.abs(amt) / 100) * (Math.PI * 0.9);
    const R = w / A;
    const half = A / 2;
    const sx = -R * Math.sin(half);
    const ex = R * Math.sin(half);
    let sy = R * (1 - Math.cos(half));
    let ey = sy;
    let sweep = 1; // positive = arch (∩), middle rides up
    if (amt < 0) {
      sy = -sy;
      ey = -ey;
      sweep = 0; // negative = valley (∪)
    }
    const d = `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${R.toFixed(2)} ${R.toFixed(
      2
    )} 0 0 ${sweep} ${ex.toFixed(2)} ${ey.toFixed(2)}`;
    obj.set({ path: new Path(d, { fill: "", stroke: "" }), pathAlign: "center" });
    obj.initDimensions?.();
    obj.setCoords();
  }

  /** Curve the active text along an arc. amount -100..100 (0 = straight). */
  setTextCurve(amount) {
    const obj = this.canvas.getActiveObject();
    if (!(obj instanceof IText)) return;
    obj.curve = Math.max(-100, Math.min(100, Number(amount) || 0));
    this._applyCurve(obj);
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  /* ------------------------------ fills ------------------------------ */

  setSolidFill(color) {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    obj.set({ fill: color, fillType: "solid", gradient: null });
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  /**
   * Apply a 2-stop gradient fill.
   * spec = { type: 'linear'|'radial', colors: [c1, c2], angle }
   */
  setGradientFill(spec) {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    const type = spec.type === "radial" ? "radial" : "linear";
    const colors = spec.colors || ["#6366f1", "#ec4899"];
    const angle = spec.angle ?? 90;
    const rad = (angle * Math.PI) / 180;
    const coords =
      type === "linear"
        ? {
            x1: 0.5 - Math.cos(rad) / 2,
            y1: 0.5 - Math.sin(rad) / 2,
            x2: 0.5 + Math.cos(rad) / 2,
            y2: 0.5 + Math.sin(rad) / 2,
          }
        : { x1: 0.5, y1: 0.5, r1: 0, x2: 0.5, y2: 0.5, r2: 0.5 };
    const gradient = new Gradient({
      type,
      gradientUnits: "percentage",
      coords,
      colorStops: [
        { offset: 0, color: colors[0] },
        { offset: 1, color: colors[1] },
      ],
    });
    obj.set({ fill: gradient, fillType: "gradient", gradient: { type, colors, angle } });
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  /** Fill a shape with an image (a simple "frame" / image-holder). */
  fillWithImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const obj = this.canvas.getActiveObject();
      if (!obj) {
        reject(new Error("Select a shape first."));
        return;
      }
      if (!file || !file.type?.startsWith("image/")) {
        reject(new Error("Please choose a valid image file."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read the image file."));
      reader.onload = () => {
        const el = new Image();
        el.onload = () => {
          const w = obj.width || el.width;
          const h = obj.height || el.height;
          // Scale the source to cover the shape's local box.
          const scale = Math.max(w / el.width, h / el.height);
          const pattern = new Pattern({
            source: el,
            repeat: "no-repeat",
            patternTransform: [scale, 0, 0, scale, 0, 0],
          });
          obj.set({ fill: pattern, fillType: "image", gradient: null });
          this.canvas.requestRenderAll();
          this._emitSelection();
          this._commit();
          resolve(obj);
        };
        el.onerror = () => reject(new Error("Failed to load image."));
        el.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  /** Current shadow values of an object, falling back to sensible defaults. */
  _readShadow(obj) {
    const s = obj.shadow;
    return {
      color: s && typeof s.color === "string" ? s.color : "rgba(0,0,0,0.45)",
      blur: s ? s.blur ?? 0 : 10,
      offsetX: s ? s.offsetX ?? 0 : 4,
      offsetY: s ? s.offsetY ?? 0 : 4,
    };
  }

  /**
   * Toggle the drop shadow on the active object (text, shape, or image).
   * Enabling preserves any previously set blur/offset so re-toggling is lossless.
   */
  setShadow(enabled, color) {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    if (!enabled) {
      obj.set("shadow", null);
    } else {
      const cur = this._readShadow(obj);
      obj.set(
        "shadow",
        new Shadow({
          color: color || cur.color,
          blur: cur.blur,
          offsetX: cur.offsetX,
          offsetY: cur.offsetY,
        })
      );
    }
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  /** Merge-and-apply individual shadow properties (color/blur/offsetX/offsetY). */
  setShadowProps(partial) {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    const next = { ...this._readShadow(obj), ...partial };
    obj.set(
      "shadow",
      new Shadow({
        color: next.color,
        blur: next.blur,
        offsetX: next.offsetX,
        offsetY: next.offsetY,
      })
    );
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  /**
   * Set the active object's blend mode (canvas compositing against the layers
   * beneath it). "source-over" is normal. Applies to text, shapes, and images.
   */
  setBlendMode(mode) {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    obj.set("globalCompositeOperation", mode || "source-over");
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  /* ------------------------------ images ----------------------------- */

  _activeImage() {
    const obj = this.canvas.getActiveObject();
    return obj instanceof FabricImage ? obj : null;
  }

  flipImage(axis) {
    const img = this._activeImage();
    if (!img) return;
    const key = axis === "y" ? "flipY" : "flipX";
    img.set(key, !img[key]);
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  /**
   * Swap the active image's source while preserving its frame: position, angle,
   * flip, display size, filters/adjustments, shadow, and mask all carry over to
   * the new picture. The new image is fit to the previous on-screen box.
   */
  async replaceActiveImage(url) {
    const img = this._activeImage();
    if (!img) return;
    const targetW = img.getScaledWidth();
    const targetH = img.getScaledHeight();
    const maskShape = this._maskShapeOf(img);
    try {
      await img.setSrc(String(url), { crossOrigin: "anonymous" });
    } catch (err) {
      throw err instanceof Error ? err : new Error("Could not load the image.");
    }
    const el = img._element || img.getElement?.();
    const natW = el?.naturalWidth || img.width || 1;
    const natH = el?.naturalHeight || img.height || 1;
    // Reset any crop to the full new image, then refit to the old display box.
    img.set({ cropX: 0, cropY: 0, width: natW, height: natH });
    img.scaleX = targetW / natW;
    img.scaleY = targetH / natH;
    img.applyFilters?.(); // re-apply existing filters to the new pixels
    // Rebuild the mask (if any) to fit the new image, using the captured ref so
    // a selection change during the async load can't retarget it.
    if (maskShape && maskShape !== "none") this._applyMask(img, maskShape);
    img.setCoords();
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  _maskShapeOf(img) {
    const cp = img.clipPath;
    if (!cp) return "none";
    if (cp instanceof Circle) return "circle";
    if (cp instanceof Polygon) return "diamond";
    if (cp instanceof Triangle) return "triangle";
    if (cp instanceof Rect) return cp.rx > 0 ? "rounded" : "none";
    return "none";
  }

  _readAdjustments(img) {
    const fs = img.filters || [];
    const find = (Cls) => (Cls ? fs.find((f) => f instanceof Cls) : undefined);
    const blends = fs.filter((f) => f instanceof fabricFilters.BlendColor);
    const hasBlend = blends.length > 0;
    // Duotone is encoded as two BlendColors over a Grayscale base: a "multiply"
    // pass tints the shadows and a "screen" pass tints the highlights.
    const mult = blends.find((b) => b.mode === "multiply");
    const scr = blends.find((b) => b.mode === "screen");
    return {
      brightness: find(fabricFilters.Brightness)?.brightness ?? 0,
      contrast: find(fabricFilters.Contrast)?.contrast ?? 0,
      saturation: find(fabricFilters.Saturation)?.saturation ?? 0,
      blur: find(fabricFilters.Blur)?.blur ?? 0,
      // A standalone Grayscale is "B&W"; Grayscale + BlendColor(s) is Duotone.
      grayscale: !!find(fabricFilters.Grayscale) && !hasBlend,
      sepia: !!find(fabricFilters.Sepia),
      invert: !!find(fabricFilters.Invert),
      duotone: hasBlend,
      duotoneShadow: (mult && typeof mult.color === "string" ? mult.color : null) || DUOTONE_DEFAULT.shadow,
      duotoneHighlight: (scr && typeof scr.color === "string" ? scr.color : null) || DUOTONE_DEFAULT.highlight,
    };
  }

  /**
   * Merge-and-apply image adjustments. Supports brightness/contrast/saturation,
   * blur, and the toggles grayscale/sepia/invert/duotone. The filter stack is
   * rebuilt from the merged state each call so toggles compose predictably.
   */
  setImageAdjustments(partial) {
    const img = this._activeImage();
    if (!img) return;
    const a = { ...this._readAdjustments(img), ...partial };
    const f = [];
    if (a.brightness) f.push(new fabricFilters.Brightness({ brightness: a.brightness }));
    if (a.contrast) f.push(new fabricFilters.Contrast({ contrast: a.contrast }));
    if (a.saturation) f.push(new fabricFilters.Saturation({ saturation: a.saturation }));
    if (a.blur) f.push(new fabricFilters.Blur({ blur: a.blur }));
    if (a.grayscale || a.duotone) f.push(new fabricFilters.Grayscale());
    if (a.sepia) f.push(new fabricFilters.Sepia());
    if (a.invert) f.push(new fabricFilters.Invert());
    // Duotone: map the desaturated image onto two colors — "multiply" pulls the
    // shadows toward the dark color, "screen" lifts the highlights toward the light.
    if (a.duotone) {
      f.push(new fabricFilters.BlendColor({ color: a.duotoneShadow || DUOTONE_DEFAULT.shadow, mode: "multiply", alpha: 1 }));
      f.push(new fabricFilters.BlendColor({ color: a.duotoneHighlight || DUOTONE_DEFAULT.highlight, mode: "screen", alpha: 1 }));
    }
    img.filters = f;
    img.applyFilters();
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  /** Non-destructive center crop to an aspect ratio (null = original). */
  setImageCrop(aspect) {
    const img = this._activeImage();
    if (!img) return;
    const el = img._element || img.getElement?.();
    const natW = el?.naturalWidth || img.width;
    const natH = el?.naturalHeight || img.height;
    if (aspect == null) {
      img.set({ cropX: 0, cropY: 0, width: natW, height: natH });
    } else {
      let rw, rh;
      if (natW / natH > aspect) {
        rh = natH;
        rw = Math.round(natH * aspect);
      } else {
        rw = natW;
        rh = Math.round(natW / aspect);
      }
      img.set({
        cropX: Math.round((natW - rw) / 2),
        cropY: Math.round((natH - rh) / 2),
        width: rw,
        height: rh,
      });
    }
    img.setCoords();
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  /** Build and set a mask clipPath on a specific image (pure; no render/commit). */
  _applyMask(img, shape) {
    const w = img.width;
    const h = img.height;
    const opts = { originX: "center", originY: "center" };
    let clip = null;
    if (shape === "circle") {
      clip = new Circle({ radius: Math.min(w, h) / 2, ...opts });
    } else if (shape === "rounded") {
      const r = Math.min(w, h) * 0.12;
      clip = new Rect({ width: w, height: h, rx: r, ry: r, ...opts });
    } else if (shape === "triangle") {
      clip = new Triangle({ width: w, height: h, ...opts });
    } else if (shape === "diamond") {
      clip = new Polygon(
        [
          { x: 0, y: -h / 2 },
          { x: w / 2, y: 0 },
          { x: 0, y: h / 2 },
          { x: -w / 2, y: 0 },
        ],
        opts
      );
    }
    img.set("clipPath", clip);
  }

  /** Mask the image to a shape via clipPath (none/circle/rounded/triangle/diamond). */
  setImageMask(shape) {
    const img = this._activeImage();
    if (!img) return;
    this._applyMask(img, shape);
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  /**
   * Position the active image to the page: "fit" contains it inside the
   * artboard; "fill" covers the artboard (may overflow). Resets rotation and
   * centers. Uses the image's current (post-crop) element size.
   */
  fitImageToPage(mode = "fit") {
    const img = this._activeImage();
    if (!img) return;
    const iw = img.width || 1;
    const ih = img.height || 1;
    const sx = this.width / iw;
    const sy = this.height / ih;
    const scale = mode === "fill" ? Math.max(sx, sy) : Math.min(sx, sy);
    img.set({
      angle: 0,
      scaleX: scale,
      scaleY: scale,
      left: (this.width - iw * scale) / 2,
      top: (this.height - ih * scale) / 2,
    });
    img.setCoords();
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commitNow();
  }

  /* ------------------- templates & components ------------------------ */

  /** Replace the current page's content with a built-in template. */
  async applyTemplate(template) {
    if (!template) return;
    this._atomic(() => {
      this.canvas.remove(...this.canvas.getObjects());
      this.canvas.backgroundColor =
        typeof template.background === "function"
          ? template.background(this.width, this.height)
          : template.background || "#ffffff";
      const objs = template.build({ width: this.width, height: this.height }) || [];
      objs.forEach((o) => {
        this._assignIdentity(o, o.name || o.type);
        this.canvas.add(o);
      });
      this.canvas.discardActiveObject();
    });
    await this._ensureFontsLoaded();
    this.canvas.requestRenderAll();
    this._sync();
  }

  /** Render just the selection's bounding box to a PNG data URL (for previews). */
  _cropThumbnail(bbox, target = 220) {
    const z = this.zoom;
    const objs = this.canvas.getActiveObjects();
    this.canvas.discardActiveObject();
    this.canvas.setZoom(1);
    this.canvas.setDimensions({ width: this.width, height: this.height });
    const left = Math.max(0, bbox.left);
    const top = Math.max(0, bbox.top);
    const width = Math.min(bbox.width, this.width - left);
    const height = Math.min(bbox.height, this.height - top);
    const mult = Math.min(target / width, target / height, 2);
    const url = this.canvas.toDataURL({ format: "png", left, top, width, height, multiplier: mult });
    this.setZoom(z);
    // Restore the selection.
    if (objs.length === 1) {
      this.canvas.setActiveObject(objs[0]);
    } else if (objs.length > 1) {
      this.canvas.setActiveObject(new ActiveSelection(objs, { canvas: this.canvas }));
    }
    this.canvas.requestRenderAll();
    return url;
  }

  /** Serialize the current selection into a reusable component. */
  exportSelection() {
    const objs = this.canvas.getActiveObjects();
    if (!objs.length) return null;
    const active = this.canvas.getActiveObject();
    const objects = objs.map((o) => o.toObject(FabricObject.customProperties));
    const thumbnail = this._cropThumbnail(active.getBoundingRect());
    const name = objs.length === 1 ? objs[0].name || objs[0].type : `${objs.length} items`;
    return { objects, thumbnail, name };
  }

  /** Serialize the current selection for the clipboard (Ctrl+C). Null if empty. */
  copySelection() {
    const objs = this.canvas.getActiveObjects();
    if (!objs.length) return null;
    return objs.map((o) => o.toObject(FabricObject.customProperties));
  }

  /** Insert a saved component's objects onto the current page. */
  async insertComponent(objectSpecs) {
    if (!objectSpecs || !objectSpecs.length) return;
    const enlivened = await fabricUtil.enlivenObjects(objectSpecs);
    this._atomic(() => {
      this.canvas.discardActiveObject();
      enlivened.forEach((o) => {
        o.set({ left: (o.left ?? 0) + 24, top: (o.top ?? 0) + 24 });
        o.id = undefined;
        this._assignIdentity(o, o.name || o.type);
        this.canvas.add(o);
      });
      if (enlivened.length === 1) {
        this.canvas.setActiveObject(enlivened[0]);
      } else {
        this.canvas.setActiveObject(
          new ActiveSelection(enlivened, { canvas: this.canvas })
        );
      }
    });
    await this._ensureFontsLoaded();
    this.canvas.requestRenderAll();
    this._sync();
  }

  /** Ensure every font used by the current page's text is loaded. */
  async _ensureFontsLoaded() {
    if (typeof document === "undefined" || !document.fonts) return;
    const specs = new Set();
    this.canvas.getObjects().forEach((o) => {
      if (o instanceof IText && o.fontFamily) {
        const fam = String(o.fontFamily).split(",")[0].trim();
        if (fam) specs.add(`${o.fontWeight || 400} 40px ${fam}`);
      }
    });
    await Promise.all(
      [...specs].map((s) => document.fonts.load(s).catch(() => {}))
    );
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

  /** Show/hide the design grid overlay (a view aid; excluded from exports). */
  setGridVisible(enabled) {
    this._showGrid = !!enabled;
    this.canvas.requestRenderAll();
  }

  /** Set the grid spacing in canvas px (clamped to a sane range). */
  setGridSize(px) {
    const v = Math.max(5, Math.min(500, Math.round(Number(px) || GRID_SIZE)));
    this._gridSize = v;
    if (this._showGrid) this.canvas.requestRenderAll();
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
    // Snap to user ruler guides too.
    for (const g of this._userGuides || []) {
      if (g.axis === "x") vTargets.push(g.pos);
      else hTargets.push(g.pos);
    }
    // Snap to the nearest grid line for each moving edge when the grid is shown.
    if (this._showGrid) {
      const G = this._gridSize || GRID_SIZE;
      for (const m of movingV) vTargets.push(Math.round(m / G) * G);
      for (const m of movingH) hTargets.push(Math.round(m / G) * G);
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

  /** Snap the rotate handle to 15° increments (when snapping is on). */
  _onObjectRotating(e) {
    if (!this.snapEnabled) return;
    const obj = e.target;
    if (!obj) return;
    const step = 15;
    const a = obj.angle || 0;
    const snapped = Math.round(a / step) * step;
    if (Math.abs(a - snapped) <= 4) {
      obj.set("angle", ((snapped % 360) + 360) % 360);
    }
  }

  /** Rotate the active object by a relative amount (e.g. ±90°). */
  rotateBy(deg) {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    const next = (((Math.round((obj.angle || 0) + deg)) % 360) + 360) % 360;
    obj.set("angle", next);
    obj.setCoords();
    this.canvas.requestRenderAll();
    this._emitSelection();
    this._commit();
  }

  _clearGuides() {
    if (this._guides.length) {
      this._guides = [];
      this.canvas.requestRenderAll();
    }
  }

  _drawGuides() {
    if (this._suppressGuides) return;
    const user = this._userGuides || [];
    if (!this._guides.length && !user.length && !this._showGrid) return;
    const ctx = this.canvas.getContext();
    const vpt = this.canvas.viewportTransform;
    ctx.save();
    ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
    ctx.lineWidth = 1 / this.zoom;
    // Faint design grid, drawn behind the guides.
    if (this._showGrid) {
      const G = this._gridSize || GRID_SIZE;
      ctx.strokeStyle = GRID_COLOR;
      ctx.beginPath();
      for (let x = G; x < this.width; x += G) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.height);
      }
      for (let y = G; y < this.height; y += G) {
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
      }
      ctx.stroke();
    }
    // Persistent user ruler guides (cyan).
    ctx.strokeStyle = USER_GUIDE_COLOR;
    for (const g of user) {
      ctx.beginPath();
      if (g.axis === "x") {
        ctx.moveTo(g.pos, 0);
        ctx.lineTo(g.pos, this.height);
      } else {
        ctx.moveTo(0, g.pos);
        ctx.lineTo(this.width, g.pos);
      }
      ctx.stroke();
    }
    // Transient smart-snap guides (pink).
    ctx.strokeStyle = GUIDE_COLOR;
    for (const g of this._guides) {
      ctx.beginPath();
      ctx.moveTo(g.x1, g.y1);
      ctx.lineTo(g.x2, g.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* --------------------------- ruler guides -------------------------- */

  /** Add a persistent guide: axis 'x' (vertical line at canvas x) or 'y'. */
  addGuide(axis, pos) {
    if (axis !== "x" && axis !== "y") return;
    const max = axis === "x" ? this.width : this.height;
    const p = Math.round(Math.max(0, Math.min(max, pos)));
    if (!this._userGuides) this._userGuides = [];
    if (this._userGuides.some((g) => g.axis === axis && Math.abs(g.pos - p) < 2)) return;
    this._userGuides.push({ axis, pos: p });
    this.canvas.requestRenderAll();
    // Guides are part of the design now — mark dirty so autosave persists them.
    this.callbacks.onDirty?.();
  }

  /** Remove all guides on the active page. */
  clearGuides() {
    if (this._userGuides && this._userGuides.length) {
      this._userGuides.length = 0;
      this.canvas.requestRenderAll();
      this.callbacks.onDirty?.();
    }
  }

  /** Remove the nearest guide on the given axis within a small tolerance. */
  removeGuideNear(axis, pos) {
    if (!this._userGuides || !this._userGuides.length) return false;
    let bestI = -1;
    let bestD = 8; // canvas-px tolerance
    this._userGuides.forEach((g, i) => {
      if (g.axis !== axis) return;
      const d = Math.abs(g.pos - pos);
      if (d <= bestD) {
        bestD = d;
        bestI = i;
      }
    });
    if (bestI < 0) return false;
    this._userGuides.splice(bestI, 1);
    this.canvas.requestRenderAll();
    this.callbacks.onDirty?.();
    return true;
  }

  guideCount() {
    return this._userGuides ? this._userGuides.length : 0;
  }

  /** Snapshot of the active page's guides, for persistence. */
  getGuides() {
    return (this._userGuides || []).map((g) => ({ axis: g.axis, pos: g.pos }));
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

  /**
   * Export the active page as a PNG data URL. `multiplier` scales the output
   * (e.g. 2 = 2× resolution). `transparent` omits the canvas background so
   * uncovered areas are transparent (PNG only).
   */
  exportPNG({ multiplier = 1, transparent = false } = {}) {
    const z = this.zoom;
    this.canvas.discardActiveObject();
    this.canvas.setZoom(1);
    this.canvas.setDimensions({ width: this.width, height: this.height });
    const prevBg = this.canvas.backgroundColor;
    if (transparent) {
      this.canvas.backgroundColor = null;
      this.canvas.requestRenderAll();
    }
    this._suppressGuides = true;
    const url = this.canvas.toDataURL({ format: "png", multiplier });
    this._suppressGuides = false;
    if (transparent) this.canvas.backgroundColor = prevBg;
    this.setZoom(z);
    this.canvas.requestRenderAll();
    return url;
  }

  /**
   * Export the active page as a JPEG data URL. JPEG has no alpha, so the canvas
   * background colour (white by default) fills any transparent areas.
   * `quality` is 0–1; `multiplier` scales the output resolution.
   */
  exportJPG({ quality = 0.92, multiplier = 1 } = {}) {
    const z = this.zoom;
    this.canvas.discardActiveObject();
    this.canvas.setZoom(1);
    this.canvas.setDimensions({ width: this.width, height: this.height });
    this._suppressGuides = true;
    const url = this.canvas.toDataURL({ format: "jpeg", quality, multiplier });
    this._suppressGuides = false;
    this.setZoom(z);
    this.canvas.requestRenderAll();
    return url;
  }

  /** Export the active page as an SVG string at its intrinsic size. */
  exportSVG() {
    const z = this.zoom;
    this.canvas.discardActiveObject();
    this.canvas.setZoom(1);
    this.canvas.setDimensions({ width: this.width, height: this.height });
    const svg = this.canvas.toSVG();
    this.setZoom(z);
    this.canvas.requestRenderAll();
    return svg;
  }

  /**
   * Render an arbitrary page's JSON to a PNG data URL on an offscreen canvas,
   * without disturbing the live canvas. Used to export every page (e.g. PDF).
   */
  async renderPageJSON(json, width, height, multiplier = 1, { transparent = false, format = "png", quality = 0.92 } = {}) {
    const el = typeof document !== "undefined" ? document.createElement("canvas") : undefined;
    const staging = new StaticCanvas(el, { width, height, backgroundColor: transparent ? null : "#ffffff" });
    try {
      if (json) await staging.loadFromJSON(json);
      if (transparent) staging.backgroundColor = null; // strip page background for transparent export
      if (typeof document !== "undefined" && document.fonts) {
        const specs = new Set();
        staging.getObjects().forEach((o) => {
          if (o.fontFamily) {
            const fam = String(o.fontFamily).split(",")[0].trim();
            if (fam) specs.add(`${o.fontWeight || 400} 40px ${fam}`);
          }
        });
        await Promise.all([...specs].map((s) => document.fonts.load(s).catch(() => {})));
      }
      staging.getObjects().forEach((o) => {
        if (o.filters?.length) o.applyFilters?.();
        // Rebuild arc paths for curved text so exports match the editor even if
        // the Path was not serialized with the page JSON.
        if (o instanceof IText && o.curve) this._applyCurve(o);
      });
      staging.renderAll();
      return format === "jpeg"
        ? staging.toDataURL({ format: "jpeg", quality, multiplier })
        : staging.toDataURL({ format: "png", multiplier });
    } finally {
      staging.dispose();
    }
  }

  /** Set the active object's Present-mode entrance animation. */
  setActiveAnim(mode) {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    obj.set("anim", mode && mode !== "none" ? mode : "");
    this._emitSelection();
    this._commit();
  }

  /**
   * Render a page as a stack of full-size transparent PNG layers for Present
   * mode. Layer 0 is the background (color + image); then one layer per object
   * in z-order, each the full page with only that object visible — so stacking
   * the layers reproduces the page exactly, and each can animate in on its own.
   * If no object has an entrance animation, returns a single flattened layer.
   */
  async renderPageLayers(json, width, height, multiplier = 1) {
    const el = typeof document !== "undefined" ? document.createElement("canvas") : undefined;
    const staging = new StaticCanvas(el, { width, height, backgroundColor: "#ffffff" });
    try {
      if (json) await staging.loadFromJSON(json);
      if (typeof document !== "undefined" && document.fonts) {
        const specs = new Set();
        staging.getObjects().forEach((o) => {
          if (o.fontFamily) {
            const fam = String(o.fontFamily).split(",")[0].trim();
            if (fam) specs.add(`${o.fontWeight || 400} 40px ${fam}`);
          }
        });
        await Promise.all([...specs].map((s) => document.fonts.load(s).catch(() => {})));
      }
      const objs = staging.getObjects();
      objs.forEach((o) => {
        if (o.filters?.length) o.applyFilters?.();
        if (o instanceof IText && o.curve) this._applyCurve(o);
      });
      // Only originally-visible objects take part; hidden layers stay hidden.
      const wasVisible = objs.map((o) => o.visible !== false);
      const anyAnimated = objs.some((o, i) => wasVisible[i] && o.anim && o.anim !== "none");
      // A blend mode composites against the layers beneath it, which isolated
      // per-object layers don't have. So if any visible object uses a blend mode,
      // render the page flat (correct blending + z-order) and skip per-object
      // animation for this slide rather than showing wrong colors.
      const anyBlend = objs.some(
        (o, i) =>
          wasVisible[i] &&
          o.globalCompositeOperation &&
          o.globalCompositeOperation !== "source-over"
      );
      if (!anyAnimated || anyBlend) {
        staging.renderAll();
        return [{ url: staging.toDataURL({ format: "png", multiplier }), anim: "none" }];
      }
      // Base layer: background only (all objects hidden).
      objs.forEach((o) => (o.visible = false));
      staging.renderAll();
      const layers = [{ url: staging.toDataURL({ format: "png", multiplier }), anim: "none" }];
      // One transparent layer per originally-visible object, in z-order.
      staging.backgroundColor = null;
      staging.backgroundImage = null;
      objs.forEach((o, i) => {
        if (!wasVisible[i]) return;
        o.visible = true;
        staging.renderAll();
        layers.push({
          url: staging.toDataURL({ format: "png", multiplier }),
          anim: o.anim && o.anim !== "none" ? o.anim : "none",
        });
        o.visible = false;
      });
      return layers;
    } finally {
      staging.dispose();
    }
  }

  getThumbnail(targetWidth = 320) {
    const z = this.zoom;
    this.canvas.setZoom(1);
    this.canvas.setDimensions({ width: this.width, height: this.height });
    this._suppressGuides = true;
    const url = this.canvas.toDataURL({
      format: "png",
      multiplier: targetWidth / this.width,
    });
    this._suppressGuides = false;
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

  /**
   * Set a 2-stop gradient as the page background. The gradient is stored on the
   * canvas `backgroundColor`, so it serializes with the page JSON and renders in
   * PNG/JPG/SVG/PDF exports. spec = { type:'linear'|'radial', colors:[c1,c2], angle }.
   */
  setPageBackgroundGradient(spec = {}) {
    const type = spec.type === "radial" ? "radial" : "linear";
    const colors = spec.colors || ["#6366f1", "#ec4899"];
    const angle = spec.angle ?? 90;
    const rad = (angle * Math.PI) / 180;
    const coords =
      type === "linear"
        ? {
            x1: 0.5 - Math.cos(rad) / 2,
            y1: 0.5 - Math.sin(rad) / 2,
            x2: 0.5 + Math.cos(rad) / 2,
            y2: 0.5 + Math.sin(rad) / 2,
          }
        : { x1: 0.5, y1: 0.5, r1: 0, x2: 0.5, y2: 0.5, r2: 0.5 };
    this.canvas.backgroundColor = new Gradient({
      type,
      gradientUnits: "percentage",
      coords,
      colorStops: [
        { offset: 0, color: colors[0] },
        { offset: 1, color: colors[1] },
      ],
    });
    this.canvas.requestRenderAll();
    this._emitPageBackground();
    this._commitNow();
  }

  /**
   * Set an image as the page background (covers the artboard, behind all
   * objects). It renders above the background color, is never selectable, and
   * serializes with the page JSON so it persists and exports like the color.
   */
  async setPageBackgroundImageFromUrl(url) {
    const img = await FabricImage.fromURL(String(url), { crossOrigin: "anonymous" });
    this.canvas.backgroundImage = img;
    this._coverBackgroundImage();
    this.canvas.requestRenderAll();
    this._commitNow();
  }

  /** Scale and center the current background image to cover the artboard. */
  _coverBackgroundImage() {
    const img = this.canvas.backgroundImage;
    if (!img) return;
    const scale = Math.max(
      this.width / (img.width || 1),
      this.height / (img.height || 1)
    );
    img.set({
      originX: "center",
      originY: "center",
      left: this.width / 2,
      top: this.height / 2,
      scaleX: scale,
      scaleY: scale,
    });
    img.setCoords?.();
  }

  /** Read a device file and use it as the page background image. */
  setPageBackgroundImageFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type?.startsWith("image/")) {
        reject(new Error("Please choose a valid image file."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read the image file."));
      reader.onload = async () => {
        try {
          await this.setPageBackgroundImageFromUrl(String(reader.result));
          resolve();
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Failed to load image."));
        }
      };
      reader.readAsDataURL(file);
    });
  }

  /** Remove the page background image (keeps the background color). */
  clearPageBackgroundImage() {
    if (!this.canvas.backgroundImage) return;
    this.canvas.backgroundImage = null;
    this.canvas.requestRenderAll();
    this._commitNow();
  }

  hasPageBackgroundImage() {
    return !!this.canvas.backgroundImage;
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
    // Keep a page background image covering the new artboard size.
    this._coverBackgroundImage();
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
      // Re-apply image filters so adjustments render after a reload.
      this.canvas.getObjects().forEach((o) => {
        if (o instanceof FabricImage && o.filters?.length) o.applyFilters();
      });
      // Load any custom fonts this page uses, then re-render so the text shows
      // the real font instead of a fallback.
      await this._ensureFontsLoaded();
      // Rebuild arc paths for curved text now that fonts (and thus widths) are
      // measured correctly; the Path is derived from the persisted `curve`.
      this.canvas.getObjects().forEach((o) => {
        if (o instanceof IText && o.curve) this._applyCurve(o);
      });
      this.canvas.requestRenderAll();
    } finally {
      if (prev) prev.locked = false;
    }

    this.activePageId = pageId;
    // Point at this page's own guide list (created on first visit).
    if (!this._userGuidesByPage.has(pageId)) this._userGuidesByPage.set(pageId, []);
    this._userGuides = this._userGuidesByPage.get(pageId);
    // Seed from persisted guides when provided (authoritative on load).
    if (dims && Array.isArray(dims.guides)) {
      this._userGuides.length = 0;
      for (const g of dims.guides) {
        if (g && (g.axis === "x" || g.axis === "y") && Number.isFinite(g.pos)) {
          this._userGuides.push({ axis: g.axis, pos: g.pos });
        }
      }
      this.canvas.requestRenderAll();
    }
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
    // Also release the deleted page's guide list so it can't leak.
    this._userGuidesByPage.delete(pageId);
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
