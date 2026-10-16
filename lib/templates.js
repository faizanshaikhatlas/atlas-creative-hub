// Built-in starter templates. These are our OWN original designs, generated in
// code — no third-party template content or assets. Each `build` returns an
// array of Fabric objects positioned for the given page dimensions, so a
// template adapts to whatever canvas size it is applied to.

import { Rect, IText, Circle, Gradient } from "fabric";
import { FONTS } from "@/lib/fonts";

const font = (label) => FONTS.find((f) => f.label === label)?.css || FONTS[0].css;

function bgGradient(width, height, c1, c2) {
  const r = new Rect({
    left: 0,
    top: 0,
    width,
    height,
    selectable: false,
    evented: false,
    name: "Background",
  });
  r.set(
    "fill",
    new Gradient({
      type: "linear",
      gradientUnits: "percentage",
      coords: { x1: 0, y1: 0, x2: 1, y2: 1 },
      colorStops: [
        { offset: 0, color: c1 },
        { offset: 1, color: c2 },
      ],
    })
  );
  return r;
}

export const TEMPLATES = [
  {
    id: "bold-promo",
    label: "Bold Promo",
    background: "#0f172a",
    build({ width, height }) {
      return [
        bgGradient(width, height, "#1e1b4b", "#4f46e5"),
        new Rect({
          left: width * 0.08,
          top: height * 0.5,
          width: width * 0.14,
          height: Math.max(8, height * 0.016),
          fill: "#f59e0b",
          name: "Accent",
        }),
        new IText("YOUR\nHEADLINE", {
          left: width * 0.08,
          top: height * 0.17,
          fontFamily: font("Bebas Neue"),
          fontSize: Math.round(height * 0.22),
          fill: "#ffffff",
          lineHeight: 0.9,
          name: "Headline",
        }),
        new IText("Add your subtitle here", {
          left: width * 0.085,
          top: height * 0.57,
          fontFamily: font("Montserrat"),
          fontSize: Math.round(height * 0.05),
          fill: "#c7d2fe",
          name: "Subtitle",
        }),
      ];
    },
  },
  {
    id: "split-feature",
    label: "Split Feature",
    background: "#ffffff",
    build({ width, height }) {
      return [
        new Rect({
          left: 0,
          top: 0,
          width: width * 0.42,
          height,
          fill: "#ec4899",
          selectable: false,
          evented: false,
          name: "Panel",
        }),
        new Circle({
          left: width * 0.21,
          top: height * 0.5,
          radius: Math.min(width, height) * 0.16,
          originX: "center",
          originY: "center",
          fill: "#fbcfe8",
          name: "Circle",
        }),
        new IText("Feature\nTitle", {
          left: width * 0.48,
          top: height * 0.28,
          fontFamily: font("Poppins"),
          fontWeight: "700",
          fontSize: Math.round(height * 0.12),
          fill: "#0f172a",
          lineHeight: 1,
          name: "Title",
        }),
        new IText("Supporting copy goes right here.", {
          left: width * 0.48,
          top: height * 0.62,
          fontFamily: font("Inter"),
          fontSize: Math.round(height * 0.045),
          fill: "#475569",
          name: "Body",
        }),
      ];
    },
  },
  {
    id: "minimal-quote",
    label: "Minimal Quote",
    background: "#f8fafc",
    build({ width, height }) {
      return [
        new IText("“Design is\nintelligence made\nvisible.”", {
          left: width * 0.5,
          top: height * 0.42,
          originX: "center",
          originY: "center",
          textAlign: "center",
          fontFamily: font("Playfair Display"),
          fontSize: Math.round(height * 0.1),
          fill: "#0f172a",
          lineHeight: 1.1,
          name: "Quote",
        }),
        new Rect({
          left: width * 0.5,
          top: height * 0.72,
          width: width * 0.12,
          height: Math.max(6, height * 0.01),
          originX: "center",
          originY: "center",
          fill: "#6366f1",
          name: "Rule",
        }),
        new IText("— Author Name", {
          left: width * 0.5,
          top: height * 0.78,
          originX: "center",
          originY: "center",
          fontFamily: font("Inter"),
          fontSize: Math.round(height * 0.04),
          fill: "#64748b",
          name: "Author",
        }),
      ];
    },
  },
];
