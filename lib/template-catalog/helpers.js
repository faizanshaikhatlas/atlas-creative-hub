// Fabric builder helpers for the template catalog. Each returns an editable
// Fabric object (or array of objects) with a human-readable `name` so it shows
// up sensibly in the editor's Layers panel. Backgrounds/panels are marked
// non-selectable so they stay put, but remain fully editable via the panel.

import { Rect, IText, Circle, Line, Triangle, Polygon, Gradient } from "fabric";
import { FONTS } from "@/lib/fonts";

export const fontOf = (label) => FONTS.find((f) => f.label === label)?.css || FONTS[0].css;

function gradientFill(stops, dir) {
  const coords =
    dir === "vertical" ? { x1: 0, y1: 0, x2: 0, y2: 1 }
      : dir === "diagonal" ? { x1: 0, y1: 0, x2: 1, y2: 1 }
      : { x1: 0, y1: 0, x2: 1, y2: 0 };
  return new Gradient({
    type: "linear",
    gradientUnits: "percentage",
    coords,
    colorStops: stops.map((c, i) => ({ offset: stops.length === 1 ? 0 : i / (stops.length - 1), color: c })),
  });
}

export function solidBg(width, height, color) {
  return new Rect({ left: 0, top: 0, width, height, fill: color, selectable: false, evented: false, name: "Background" });
}

export function gradientBg(width, height, stops, dir = "diagonal") {
  const r = new Rect({ left: 0, top: 0, width, height, selectable: false, evented: false, name: "Background" });
  r.set("fill", gradientFill(stops, dir));
  r.set("fillType", "gradient");
  return r;
}

export function rect({ name = "Shape", ...opts }) {
  return new Rect({ name, ...opts });
}

export function gradientRect({ name = "Shape", ...opts }, stops, dir = "horizontal") {
  const r = new Rect({ name, ...opts });
  r.set("fill", gradientFill(stops, dir));
  r.set("fillType", "gradient");
  return r;
}

export function circle({ name = "Circle", ...opts }) {
  return new Circle({ originX: "center", originY: "center", name, ...opts });
}

export function ring(cx, cy, radius, color, weight, name = "Ring") {
  return new Circle({ left: cx, top: cy, radius, originX: "center", originY: "center", fill: "", stroke: color, strokeWidth: weight, name });
}

export function line(points, { name = "Line", ...opts }) {
  return new Line(points, { name, ...opts });
}

export function triangle({ name = "Triangle", ...opts }) {
  return new Triangle({ name, ...opts });
}

export function polygon(points, { name = "Shape", ...opts }) {
  return new Polygon(points, { name, ...opts });
}

/**
 * Text helper. `font` is a FONTS label. Supports multi-line via \n, letter
 * spacing (charSpacing, 1/1000 em), alignment and center origins.
 */
export function text(str, { font, size = 48, fill = "#111111", weight = "400", align = "left", lineHeight = 1.1, charSpacing = 0, originX = "left", originY = "top", angle = 0, opacity = 1, name = "Text", left = 0, top = 0 }) {
  return new IText(str, {
    left, top, originX, originY, angle, opacity,
    fontFamily: font ? fontOf(font) : fontOf("Inter"),
    fontSize: size, fill, fontWeight: weight, textAlign: align, lineHeight, charSpacing, name,
  });
}

/**
 * An editable image placeholder (a framed rect + a caption) where a user drops
 * their own photo. Avoids licensing/broken-URL issues; the frame can be filled
 * via the editor's "fill with image" tool, moved, resized or deleted.
 */
export function imageFrame({ x, y, w, h, fill = "#e5e7eb", label = "Replace with image", labelFill = "#94a3b8", rx = 0 }) {
  const frame = new Rect({ left: x, top: y, width: w, height: h, rx, ry: rx, fill, name: "Image frame" });
  const cap = new IText(label, {
    left: x + w / 2, top: y + h / 2, originX: "center", originY: "center",
    fontFamily: fontOf("Inter"), fontSize: Math.max(13, Math.round(Math.min(w, h) * 0.06)),
    fill: labelFill, name: "Image label",
  });
  return [frame, cap];
}
