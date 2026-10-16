// The ATLAS Creative Hub template catalog — 50 original, code-generated designs
// across 10 themes. Every object is editable Fabric content (no flattened
// images). Photo spots use editable image frames the user fills with their own
// images. Each `build({width,height})` returns objects positioned for its format.

import { solidBg, gradientBg, gradientRect, rect, circle, ring, line, triangle, polygon, text, imageFrame } from "@/lib/template-catalog/helpers";

export const TEMPLATES = [
  /* ============================ 1. LUXURY ============================ */
  {
    id: "lux-product-reveal", title: "Timeless Product Reveal", theme: "luxury", format: "yt-thumbnail",
    keywords: ["luxury", "product", "premium", "gold", "reveal"], background: "#0a0a0a",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#0a0a0a"),
        rect({ left: w * 0.04, top: h * 0.06, width: w * 0.92, height: h * 0.88, fill: "", stroke: "#d4af37", strokeWidth: 2, name: "Gold frame", selectable: false }),
        text("TIMELESS", { left: w * 0.08, top: h * 0.3, size: Math.round(h * 0.18), font: "Playfair Display", fill: "#f5e6c8", weight: "700", name: "Headline" }),
        text("ELEGANCE", { left: w * 0.08, top: h * 0.5, size: Math.round(h * 0.18), font: "Playfair Display", fill: "#d4af37", weight: "700", name: "Headline 2" }),
        rect({ left: w * 0.085, top: h * 0.72, width: w * 0.1, height: 3, fill: "#d4af37", name: "Rule" }),
        text("THE PREMIUM COLLECTION", { left: w * 0.085, top: h * 0.77, size: Math.round(h * 0.04), font: "Montserrat", fill: "#cbb57b", charSpacing: 300, name: "Subtitle" }),
        ...imageFrame({ x: w * 0.62, y: h * 0.22, w: w * 0.3, h: h * 0.56, fill: "#17130a", label: "Product photo", labelFill: "#8a7a4a" }),
      ];
    },
  },
  {
    id: "lux-gala-invite", title: "Private Gala Invitation", theme: "luxury", format: "ig-post",
    keywords: ["luxury", "invite", "gala", "event", "elegant"], background: "#0b0b0b",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#0b0b0b"),
        gradientRect({ left: 0, top: 0, width: w, height: h * 0.14 }, ["#d4af37", "#b8860b", "#d4af37"]),
        gradientRect({ left: 0, top: h * 0.86, width: w, height: h * 0.14 }, ["#d4af37", "#b8860b", "#d4af37"]),
        text("YOU ARE INVITED", { left: w / 2, top: h * 0.3, originX: "center", size: Math.round(h * 0.045), font: "Montserrat", fill: "#d4af37", charSpacing: 500, name: "Eyebrow" }),
        text("The Grand\nGala", { left: w / 2, top: h * 0.47, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.16), font: "Playfair Display", fill: "#f5e6c8", weight: "700", lineHeight: 1, name: "Headline" }),
        text("SATURDAY · 8 PM · THE RITZ", { left: w / 2, top: h * 0.66, originX: "center", size: Math.round(h * 0.035), font: "Montserrat", fill: "#cbb57b", charSpacing: 300, name: "Details" }),
      ];
    },
  },
  {
    id: "lux-private-sale", title: "Private Sale 50%", theme: "luxury", format: "ig-story",
    keywords: ["luxury", "sale", "discount", "gold", "story"], background: "#0a0a0a",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#0a0a0a"),
        gradientRect({ left: 0, top: h * 0.34, width: w, height: h * 0.32 }, ["#1a1405", "#3a2c08", "#1a1405"], "vertical"),
        text("PRIVATE", { left: w / 2, top: h * 0.4, originX: "center", size: Math.round(h * 0.1), font: "Playfair Display", fill: "#f5e6c8", weight: "700", name: "Head 1" }),
        text("SALE", { left: w / 2, top: h * 0.49, originX: "center", size: Math.round(h * 0.1), font: "Playfair Display", fill: "#d4af37", weight: "700", name: "Head 2" }),
        text("−50%", { left: w / 2, top: h * 0.6, originX: "center", size: Math.round(h * 0.07), font: "Montserrat", fill: "#f5e6c8", weight: "800", charSpacing: 200, name: "Discount" }),
        text("MEMBERS ONLY · THIS WEEKEND", { left: w / 2, top: h * 0.72, originX: "center", size: Math.round(h * 0.022), font: "Montserrat", fill: "#cbb57b", charSpacing: 300, name: "Note" }),
      ];
    },
  },
  {
    id: "lux-event-poster", title: "Luxury Event Poster", theme: "luxury", format: "poster",
    keywords: ["luxury", "poster", "event", "premium"], background: "#0b0b0b",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#0b0b0b"),
        line([w * 0.5, h * 0.1, w * 0.5, h * 0.2], { stroke: "#d4af37", strokeWidth: 2, name: "Ornament" }),
        text("MAISON", { left: w / 2, top: h * 0.26, originX: "center", size: Math.round(h * 0.055), font: "Montserrat", fill: "#d4af37", charSpacing: 700, name: "Brand" }),
        text("An Evening\nof Couture", { left: w / 2, top: h * 0.42, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.09), font: "Playfair Display", fill: "#f5e6c8", weight: "700", lineHeight: 1.05, name: "Title" }),
        rect({ left: w / 2, top: h * 0.6, width: w * 0.25, height: 2, fill: "#d4af37", originX: "center", name: "Rule" }),
        text("DECEMBER 14 · 2026\n7:00 PM · PARIS", { left: w / 2, top: h * 0.72, originX: "center", align: "center", size: Math.round(h * 0.028), font: "Montserrat", fill: "#cbb57b", charSpacing: 200, lineHeight: 1.5, name: "Details" }),
      ];
    },
  },
  {
    id: "lux-membership", title: "Exclusive Membership", theme: "luxury", format: "fb-post",
    keywords: ["luxury", "membership", "club", "premium"], background: "#0a0a0a",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#0a0a0a"),
        rect({ left: 0, top: 0, width: w * 0.5, height: h, fill: "#111111", selectable: false, name: "Panel" }),
        text("MEMBERS\nCLUB", { left: w * 0.06, top: h * 0.3, size: Math.round(h * 0.17), font: "Playfair Display", fill: "#d4af37", weight: "700", lineHeight: 1, name: "Headline" }),
        text("Unlock the exclusive experience.", { left: w * 0.06, top: h * 0.68, size: Math.round(h * 0.05), font: "Montserrat", fill: "#cbb57b", name: "Subtitle" }),
        ...imageFrame({ x: w * 0.5, y: 0, w: w * 0.5, h: h, fill: "#15110a", label: "Lifestyle photo", labelFill: "#8a7a4a" }),
      ];
    },
  },

  /* ============================ 2. MINIMAL ============================ */
  {
    id: "min-quote", title: "Minimal Quote", theme: "minimal", format: "ig-post",
    keywords: ["minimal", "quote", "clean", "typography"], background: "#ffffff",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#ffffff"),
        text("Simplicity is\nthe ultimate\nsophistication.", { left: w * 0.5, top: h * 0.42, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.085), font: "Playfair Display", fill: "#111827", lineHeight: 1.15, name: "Quote" }),
        rect({ left: w / 2, top: h * 0.72, width: w * 0.08, height: 3, fill: "#111827", originX: "center", name: "Rule" }),
        text("— LEONARDO DA VINCI", { left: w / 2, top: h * 0.78, originX: "center", size: Math.round(h * 0.03), font: "Inter", fill: "#6b7280", charSpacing: 200, name: "Author" }),
      ];
    },
  },
  {
    id: "min-title-slide", title: "Minimal Title Slide", theme: "minimal", format: "presentation",
    keywords: ["minimal", "presentation", "title", "slide"], background: "#ffffff",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#ffffff"),
        circle({ left: w * 0.1, top: h * 0.28, radius: Math.round(h * 0.02), fill: "#111827", name: "Dot" }),
        text("Designing for\nClarity", { left: w * 0.1, top: h * 0.4, originY: "center", size: Math.round(h * 0.12), font: "Inter", fill: "#111827", weight: "700", lineHeight: 1.02, name: "Title" }),
        text("A product design philosophy · 2026", { left: w * 0.1, top: h * 0.68, size: Math.round(h * 0.035), font: "Inter", fill: "#6b7280", name: "Subtitle" }),
        rect({ left: w * 0.1, top: h * 0.8, width: w * 0.12, height: 4, fill: "#111827", name: "Rule" }),
      ];
    },
  },
  {
    id: "min-tutorial", title: "Clean Tutorial Thumbnail", theme: "minimal", format: "yt-thumbnail",
    keywords: ["minimal", "tutorial", "clean", "youtube"], background: "#fafafa",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#fafafa"),
        rect({ left: 0, top: 0, width: w * 0.015, height: h, fill: "#111827", selectable: false, name: "Edge" }),
        text("01", { left: w * 0.08, top: h * 0.2, size: Math.round(h * 0.12), font: "Inter", fill: "#d1d5db", weight: "700", name: "Number" }),
        text("How to build a\nclean layout", { left: w * 0.08, top: h * 0.4, size: Math.round(h * 0.13), font: "Inter", fill: "#111827", weight: "700", lineHeight: 1.02, name: "Headline" }),
        rect({ left: w * 0.08, top: h * 0.74, width: w * 0.1, height: 4, fill: "#111827", name: "Rule" }),
        ...imageFrame({ x: w * 0.62, y: h * 0.18, w: w * 0.3, h: h * 0.64, fill: "#eef0f2", label: "Screenshot" }),
      ];
    },
  },
  {
    id: "min-gallery", title: "Minimal Gallery Poster", theme: "minimal", format: "poster",
    keywords: ["minimal", "poster", "gallery", "photo"], background: "#ffffff",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#ffffff"),
        ...imageFrame({ x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.62, fill: "#f1f3f5", label: "Feature image" }),
        text("Exhibition", { left: w * 0.1, top: h * 0.78, size: Math.round(h * 0.055), font: "Inter", fill: "#111827", weight: "700", name: "Title" }),
        text("New works · Gallery 02 · Through June", { left: w * 0.1, top: h * 0.85, size: Math.round(h * 0.026), font: "Inter", fill: "#6b7280", name: "Caption" }),
      ];
    },
  },
  {
    id: "min-announcement", title: "Minimal Announcement", theme: "minimal", format: "ig-story",
    keywords: ["minimal", "announcement", "story", "clean"], background: "#fafafa",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#fafafa"),
        text("NOW", { left: w / 2, top: h * 0.4, originX: "center", size: Math.round(h * 0.03), font: "Inter", fill: "#6b7280", charSpacing: 600, name: "Eyebrow" }),
        text("We're\nopen.", { left: w / 2, top: h * 0.5, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.11), font: "Inter", fill: "#111827", weight: "700", lineHeight: 1, name: "Headline" }),
        rect({ left: w / 2, top: h * 0.64, width: w * 0.12, height: 3, fill: "#111827", originX: "center", name: "Rule" }),
        text("Visit us this week", { left: w / 2, top: h * 0.7, originX: "center", size: Math.round(h * 0.028), font: "Inter", fill: "#6b7280", name: "Sub" }),
      ];
    },
  },

  /* ======================= 3. BOLD VIRAL YOUTUBE ======================= */
  {
    id: "yt-i-did-this", title: "I Actually Did This!", theme: "youtube", format: "yt-thumbnail",
    keywords: ["youtube", "thumbnail", "viral", "bold", "mrbeast"], background: "#0b1020",
    build({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#2563eb", "#7c3aed", "#db2777"], "diagonal"),
        text("I ACTUALLY\nDID THIS!", { left: w * 0.04, top: h * 0.12, size: Math.round(h * 0.26), font: "Anton", fill: "#ffffff", lineHeight: 0.92, name: "Headline" }),
        rect({ left: w * 0.045, top: h * 0.1, width: w * 0.5, height: h * 0.52, fill: "", stroke: "#ffde59", strokeWidth: 0, name: "spacer", opacity: 0 }),
        triangle({ left: w * 0.5, top: h * 0.78, width: w * 0.08, height: w * 0.06, fill: "#ffde59", angle: 90, name: "Arrow" }),
        circle({ left: w * 0.78, top: h * 0.5, radius: h * 0.33, fill: "", stroke: "#ffde59", strokeWidth: 10, name: "Highlight" }),
        ...imageFrame({ x: w * 0.57, y: h * 0.14, w: w * 0.42, h: h * 0.74, fill: "#0b1020", label: "Your face / subject", labelFill: "#93c5fd" }),
      ];
    },
  },
  {
    id: "yt-shocking", title: "Shocking Reveal", theme: "youtube", format: "yt-thumbnail",
    keywords: ["youtube", "thumbnail", "shocking", "reveal", "contrast"], background: "#111111",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#111111"),
        rect({ left: 0, top: 0, width: w * 0.55, height: h, fill: "#ffde59", selectable: false, name: "Panel" }),
        text("YOU WON'T\nBELIEVE\nTHIS", { left: w * 0.04, top: h * 0.14, size: Math.round(h * 0.2), font: "Anton", fill: "#111111", lineHeight: 0.92, name: "Headline" }),
        circle({ left: w * 0.76, top: h * 0.5, radius: h * 0.28, fill: "#ff0033", name: "Burst" }),
        text("WOW", { left: w * 0.76, top: h * 0.5, originX: "center", originY: "center", size: Math.round(h * 0.14), font: "Anton", fill: "#ffffff", angle: -8, name: "Sticker" }),
      ];
    },
  },
  {
    id: "yt-channel-banner", title: "Channel Banner", theme: "youtube", format: "yt-banner",
    keywords: ["youtube", "banner", "channel", "header"], background: "#0b1020",
    build({ width: w, height: h }) {
      // Content kept within the centered title-safe area (~1546x423).
      const cy = h / 2;
      return [
        gradientBg(w, h, ["#111111", "#2563eb", "#111111"], "horizontal"),
        text("PIXEL\nFORGE", { left: w / 2, top: cy, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.12), font: "Anton", fill: "#ffffff", lineHeight: 0.95, name: "Channel name" }),
        rect({ left: w / 2, top: cy + h * 0.1, width: w * 0.12, height: 6, fill: "#ffde59", originX: "center", name: "Rule" }),
        text("NEW VIDEOS EVERY FRIDAY", { left: w / 2, top: cy + h * 0.15, originX: "center", size: Math.round(h * 0.03), font: "Montserrat", fill: "#93c5fd", charSpacing: 400, weight: "700", name: "Tagline" }),
      ];
    },
  },
  {
    id: "yt-top-10", title: "Top 10 Countdown", theme: "youtube", format: "yt-thumbnail",
    keywords: ["youtube", "top10", "list", "countdown"], background: "#111111",
    build({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#111111", "#3b0764"], "diagonal"),
        text("TOP", { left: w * 0.06, top: h * 0.18, size: Math.round(h * 0.14), font: "Anton", fill: "#ffde59", name: "Top" }),
        text("10", { left: w * 0.04, top: h * 0.28, size: Math.round(h * 0.5), font: "Anton", fill: "#ff0033", name: "Number" }),
        text("GADGETS\nOF 2026", { left: w * 0.42, top: h * 0.3, size: Math.round(h * 0.16), font: "Anton", fill: "#ffffff", lineHeight: 0.95, name: "Headline" }),
        ...imageFrame({ x: w * 0.42, y: h * 0.66, w: w * 0.5, h: h * 0.26, fill: "#1f2937", label: "Product strip" }),
      ];
    },
  },
  {
    id: "yt-vs-battle", title: "VS Battle", theme: "youtube", format: "yt-thumbnail",
    keywords: ["youtube", "vs", "battle", "versus", "split"], background: "#111111",
    build({ width: w, height: h }) {
      return [
        rect({ left: 0, top: 0, width: w / 2, height: h, fill: "#dc2626", selectable: false, name: "Left" }),
        rect({ left: w / 2, top: 0, width: w / 2, height: h, fill: "#2563eb", selectable: false, name: "Right" }),
        ...imageFrame({ x: w * 0.04, y: h * 0.12, w: w * 0.4, h: h * 0.76, fill: "#7f1d1d", label: "Option A", labelFill: "#fecaca" }),
        ...imageFrame({ x: w * 0.56, y: h * 0.12, w: w * 0.4, h: h * 0.76, fill: "#1e3a8a", label: "Option B", labelFill: "#bfdbfe" }),
        circle({ left: w / 2, top: h / 2, radius: h * 0.14, fill: "#111111", stroke: "#ffffff", strokeWidth: 6, name: "Badge" }),
        text("VS", { left: w / 2, top: h / 2, originX: "center", originY: "center", size: Math.round(h * 0.14), font: "Anton", fill: "#ffde59", name: "VS" }),
      ];
    },
  },

  /* =========================== 4. CREATIVE =========================== */
  {
    id: "cre-gradient-abstract", title: "Gradient Abstract", theme: "creative", format: "ig-post",
    keywords: ["creative", "gradient", "abstract", "geometric"], background: "#1b1033",
    build({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#7c3aed", "#ec4899", "#22d3ee"], "diagonal"),
        circle({ left: w * 0.78, top: h * 0.22, radius: h * 0.16, fill: "#fde047", opacity: 0.9, name: "Circle" }),
        triangle({ left: w * 0.15, top: h * 0.8, width: w * 0.22, height: w * 0.22, fill: "#111827", angle: 20, opacity: 0.85, name: "Triangle" }),
        text("create\nwithout\nlimits", { left: w * 0.5, top: h * 0.5, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.13), font: "Poppins", fill: "#ffffff", weight: "700", lineHeight: 1, name: "Headline" }),
      ];
    },
  },
  {
    id: "cre-art-expo", title: "Art Expo Poster", theme: "creative", format: "poster",
    keywords: ["creative", "art", "expo", "editorial"], background: "#faf5ff",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#faf5ff"),
        gradientRect({ left: 0, top: h * 0.5, width: w, height: h * 0.5 }, ["#ec4899", "#7c3aed"], "diagonal"),
        text("ART\nEXPO", { left: w * 0.08, top: h * 0.14, size: Math.round(h * 0.16), font: "Playfair Display", fill: "#111827", weight: "700", lineHeight: 0.95, name: "Title", angle: -4 }),
        circle({ left: w * 0.78, top: h * 0.22, radius: h * 0.08, fill: "#22d3ee", name: "Dot" }),
        text("Contemporary works\nby 20 artists", { left: w * 0.08, top: h * 0.6, size: Math.round(h * 0.05), font: "Poppins", fill: "#ffffff", weight: "600", lineHeight: 1.2, name: "Body" }),
        text("MAY 3–30 · HALL 7", { left: w * 0.08, top: h * 0.86, size: Math.round(h * 0.03), font: "Poppins", fill: "#faf5ff", charSpacing: 200, name: "Details" }),
      ];
    },
  },
  {
    id: "cre-workshop", title: "Creative Workshop", theme: "creative", format: "ig-story",
    keywords: ["creative", "workshop", "story", "class"], background: "#0f172a",
    build({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#22d3ee", "#7c3aed", "#ec4899"], "vertical"),
        polygon([{ x: 0, y: h * 0.3 }, { x: w, y: h * 0.2 }, { x: w, y: h * 0.4 }, { x: 0, y: h * 0.5 }], { fill: "#111827", opacity: 0.25, name: "Band" }),
        text("DESIGN\nWORKSHOP", { left: w / 2, top: h * 0.42, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.075), font: "Poppins", fill: "#ffffff", weight: "700", lineHeight: 1, name: "Headline" }),
        rect({ left: w / 2, top: h * 0.62, width: w * 0.55, height: h * 0.07, rx: h * 0.035, fill: "#111827", originX: "center", name: "CTA" }),
        text("RESERVE YOUR SEAT", { left: w / 2, top: h * 0.655, originX: "center", originY: "center", size: Math.round(h * 0.024), font: "Poppins", fill: "#ffffff", weight: "600", charSpacing: 200, name: "CTA text" }),
      ];
    },
  },
  {
    id: "cre-portfolio", title: "Portfolio Cover", theme: "creative", format: "presentation",
    keywords: ["creative", "portfolio", "cover", "design"], background: "#111827",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#0f172a"),
        gradientRect({ left: 0, top: 0, width: w * 0.42, height: h }, ["#7c3aed", "#ec4899"], "vertical"),
        circle({ left: w * 0.21, top: h * 0.5, radius: h * 0.14, fill: "#22d3ee", name: "Accent" }),
        text("Portfolio", { left: w * 0.5, top: h * 0.4, size: Math.round(h * 0.11), font: "Playfair Display", fill: "#ffffff", weight: "700", name: "Title" }),
        text("Selected works 2024–2026", { left: w * 0.5, top: h * 0.56, size: Math.round(h * 0.035), font: "Poppins", fill: "#a5b4fc", name: "Subtitle" }),
      ];
    },
  },
  {
    id: "cre-studio", title: "Creative Studio Promo", theme: "creative", format: "fb-post",
    keywords: ["creative", "studio", "promo", "brand"], background: "#faf5ff",
    build({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#ec4899", "#7c3aed"], "horizontal"),
        circle({ left: w * 0.12, top: h * 0.3, radius: h * 0.12, fill: "#fde047", opacity: 0.9, name: "Dot" }),
        triangle({ left: w * 0.85, top: h * 0.7, width: w * 0.07, height: w * 0.07, fill: "#22d3ee", angle: 30, name: "Tri" }),
        text("Bold ideas,\nbeautifully made.", { left: w * 0.5, top: h * 0.45, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.11), font: "Poppins", fill: "#ffffff", weight: "700", lineHeight: 1.05, name: "Headline" }),
        text("ATLAS CREATIVE STUDIO", { left: w / 2, top: h * 0.82, originX: "center", size: Math.round(h * 0.03), font: "Poppins", fill: "#f5f3ff", charSpacing: 300, name: "Wordmark" }),
      ];
    },
  },

  /* ========================== 5. CORPORATE ========================== */
  {
    id: "corp-title-slide", title: "Business Title Slide", theme: "corporate", format: "presentation",
    keywords: ["corporate", "business", "slide", "title"], background: "#0f3d6e",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#0f3d6e"),
        rect({ left: 0, top: 0, width: w * 0.012, height: h, fill: "#2563eb", selectable: false, name: "Edge" }),
        text("ANNUAL REVIEW 2026", { left: w * 0.08, top: h * 0.28, size: Math.round(h * 0.03), font: "Montserrat", fill: "#60a5fa", charSpacing: 300, weight: "700", name: "Eyebrow" }),
        text("Driving Growth,\nDelivering Value", { left: w * 0.08, top: h * 0.4, originY: "center", size: Math.round(h * 0.1), font: "Montserrat", fill: "#ffffff", weight: "800", lineHeight: 1.05, name: "Title" }),
        rect({ left: w * 0.08, top: h * 0.64, width: w * 0.12, height: 5, fill: "#2563eb", name: "Rule" }),
        text("Prepared by the Strategy Team", { left: w * 0.08, top: h * 0.86, size: Math.round(h * 0.028), font: "Inter", fill: "#cbd5e1", name: "Footer" }),
      ];
    },
  },
  {
    id: "corp-announcement", title: "Company Announcement", theme: "corporate", format: "fb-post",
    keywords: ["corporate", "announcement", "news", "update"], background: "#ffffff",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#ffffff"),
        rect({ left: 0, top: 0, width: w, height: h * 0.16, fill: "#0f3d6e", selectable: false, name: "Header" }),
        text("ANNOUNCEMENT", { left: w * 0.05, top: h * 0.055, size: Math.round(h * 0.05), font: "Montserrat", fill: "#ffffff", weight: "700", charSpacing: 200, name: "Kicker" }),
        text("We're expanding to\nthree new markets", { left: w * 0.05, top: h * 0.32, size: Math.round(h * 0.09), font: "Montserrat", fill: "#0f3d6e", weight: "800", lineHeight: 1.05, name: "Headline" }),
        rect({ left: w * 0.05, top: h * 0.72, width: w * 0.26, height: h * 0.12, rx: h * 0.02, fill: "#2563eb", name: "CTA" }),
        text("Read the news", { left: w * 0.05 + w * 0.13, top: h * 0.78, originX: "center", originY: "center", size: Math.round(h * 0.035), font: "Inter", fill: "#ffffff", weight: "700", name: "CTA text" }),
      ];
    },
  },
  {
    id: "corp-report", title: "Quarterly Report", theme: "corporate", format: "ig-post",
    keywords: ["corporate", "report", "stats", "chart"], background: "#f8fafc",
    build({ width: w, height: h }) {
      const base = h * 0.78;
      const bars = [0.34, 0.52, 0.46, 0.68, 0.8];
      const barObjs = bars.map((v, i) =>
        rect({ left: w * (0.12 + i * 0.15), top: base - h * v * 0.42, width: w * 0.09, height: h * v * 0.42, fill: i === 4 ? "#2563eb" : "#93c5fd", name: `Bar ${i + 1}` })
      );
      return [
        solidBg(w, h, "#f8fafc"),
        text("Q4 PERFORMANCE", { left: w * 0.12, top: h * 0.1, size: Math.round(h * 0.035), font: "Montserrat", fill: "#2563eb", charSpacing: 200, weight: "700", name: "Eyebrow" }),
        text("+38%", { left: w * 0.12, top: h * 0.16, size: Math.round(h * 0.14), font: "Montserrat", fill: "#0f3d6e", weight: "800", name: "Stat" }),
        line([w * 0.12, base, w * 0.9, base], { stroke: "#cbd5e1", strokeWidth: 2, name: "Axis" }),
        ...barObjs,
        text("Year-over-year revenue growth", { left: w * 0.12, top: h * 0.86, size: Math.round(h * 0.028), font: "Inter", fill: "#64748b", name: "Caption" }),
      ];
    },
  },
  {
    id: "corp-conference", title: "Conference Poster", theme: "corporate", format: "poster",
    keywords: ["corporate", "conference", "event", "summit"], background: "#0f3d6e",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#0f3d6e"),
        gradientRect({ left: 0, top: 0, width: w, height: h * 0.4 }, ["#2563eb", "#0f3d6e"], "vertical"),
        text("FUTURE OF\nFINANCE", { left: w * 0.08, top: h * 0.1, size: Math.round(h * 0.1), font: "Montserrat", fill: "#ffffff", weight: "800", lineHeight: 1, name: "Title" }),
        text("GLOBAL SUMMIT 2026", { left: w * 0.08, top: h * 0.32, size: Math.round(h * 0.03), font: "Montserrat", fill: "#93c5fd", charSpacing: 300, name: "Sub" }),
        ...imageFrame({ x: w * 0.08, y: h * 0.46, w: w * 0.84, h: h * 0.3, fill: "#0b2d52", label: "Speakers", labelFill: "#60a5fa" }),
        text("NOV 18–20 · SINGAPORE", { left: w * 0.08, top: h * 0.84, size: Math.round(h * 0.03), font: "Inter", fill: "#e2e8f0", charSpacing: 150, name: "Details" }),
      ];
    },
  },
  {
    id: "corp-data-slide", title: "Data Highlights Slide", theme: "corporate", format: "presentation",
    keywords: ["corporate", "data", "slide", "kpi"], background: "#ffffff",
    build({ width: w, height: h }) {
      const stats = [["$4.2M", "Revenue"], ["128K", "Customers"], ["99.9%", "Uptime"]];
      const cards = stats.flatMap(([n, l], i) => {
        const x = w * (0.08 + i * 0.3);
        return [
          rect({ left: x, top: h * 0.4, width: w * 0.24, height: h * 0.34, rx: h * 0.02, fill: "#f1f5f9", name: `Card ${i + 1}` }),
          text(n, { left: x + w * 0.02, top: h * 0.46, size: Math.round(h * 0.09), font: "Montserrat", fill: "#0f3d6e", weight: "800", name: `Stat ${i + 1}` }),
          text(l, { left: x + w * 0.02, top: h * 0.63, size: Math.round(h * 0.03), font: "Inter", fill: "#64748b", name: `Label ${i + 1}` }),
        ];
      });
      return [
        solidBg(w, h, "#ffffff"),
        text("By the numbers", { left: w * 0.08, top: h * 0.14, size: Math.round(h * 0.07), font: "Montserrat", fill: "#0f3d6e", weight: "800", name: "Title" }),
        rect({ left: w * 0.08, top: h * 0.3, width: w * 0.1, height: 5, fill: "#2563eb", name: "Rule" }),
        ...cards,
      ];
    },
  },

  /* ========================== 6. EDUCATION ========================== */
  {
    id: "edu-admissions", title: "Admissions Open", theme: "education", format: "ig-post",
    keywords: ["education", "admissions", "university", "apply"], background: "#1e40af",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#1e40af"),
        rect({ left: 0, top: 0, width: w, height: h * 0.12, fill: "#f59e0b", selectable: false, name: "Top bar" }),
        text("ADMISSIONS 2026", { left: w / 2, top: h * 0.055, originX: "center", originY: "center", size: Math.round(h * 0.04), font: "Poppins", fill: "#1e3a8a", weight: "700", charSpacing: 200, name: "Kicker" }),
        text("Now\nOpen", { left: w / 2, top: h * 0.42, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.17), font: "Poppins", fill: "#ffffff", weight: "700", lineHeight: 0.95, name: "Headline" }),
        rect({ left: w / 2, top: h * 0.72, width: w * 0.5, height: h * 0.1, rx: h * 0.05, fill: "#f59e0b", originX: "center", name: "CTA" }),
        text("APPLY NOW", { left: w / 2, top: h * 0.77, originX: "center", originY: "center", size: Math.round(h * 0.04), font: "Poppins", fill: "#1e3a8a", weight: "700", charSpacing: 150, name: "CTA text" }),
      ];
    },
  },
  {
    id: "edu-course", title: "Course Promotion", theme: "education", format: "poster",
    keywords: ["education", "course", "promotion", "learn"], background: "#ffffff",
    build({ width: w, height: h }) {
      const bullets = ["Hands-on projects", "Expert instructors", "Certificate included"];
      const items = bullets.map((b, i) => [
        circle({ left: w * 0.12, top: h * (0.54 + i * 0.08), radius: h * 0.01, fill: "#f59e0b", name: `Dot ${i + 1}` }),
        text(b, { left: w * 0.16, top: h * (0.525 + i * 0.08), size: Math.round(h * 0.03), font: "Inter", fill: "#334155", name: `Bullet ${i + 1}` }),
      ]).flat();
      return [
        solidBg(w, h, "#ffffff"),
        rect({ left: 0, top: 0, width: w, height: h * 0.4, fill: "#1e40af", selectable: false, name: "Header" }),
        text("Data Science\nBootcamp", { left: w * 0.08, top: h * 0.1, size: Math.round(h * 0.08), font: "Poppins", fill: "#ffffff", weight: "700", lineHeight: 1.05, name: "Title" }),
        text("12-WEEK PROGRAM", { left: w * 0.08, top: h * 0.3, size: Math.round(h * 0.028), font: "Poppins", fill: "#fcd34d", charSpacing: 300, name: "Sub" }),
        ...items,
        rect({ left: w * 0.08, top: h * 0.82, width: w * 0.4, height: h * 0.08, rx: h * 0.04, fill: "#f59e0b", name: "CTA" }),
        text("Enroll today", { left: w * 0.08 + w * 0.2, top: h * 0.86, originX: "center", originY: "center", size: Math.round(h * 0.03), font: "Poppins", fill: "#1e3a8a", weight: "700", name: "CTA text" }),
      ];
    },
  },
  {
    id: "edu-campus-event", title: "Campus Event", theme: "education", format: "fb-post",
    keywords: ["education", "campus", "event", "festival"], background: "#eff6ff",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#eff6ff"),
        rect({ left: w * 0.06, top: h * 0.2, width: w * 0.22, height: h * 0.6, rx: h * 0.03, fill: "#1e40af", name: "Date block" }),
        text("18", { left: w * 0.17, top: h * 0.4, originX: "center", originY: "center", size: Math.round(h * 0.22), font: "Poppins", fill: "#ffffff", weight: "700", name: "Day" }),
        text("MAR", { left: w * 0.17, top: h * 0.62, originX: "center", originY: "center", size: Math.round(h * 0.06), font: "Poppins", fill: "#fcd34d", weight: "700", charSpacing: 200, name: "Month" }),
        text("Spring\nCampus Fest", { left: w * 0.34, top: h * 0.3, size: Math.round(h * 0.11), font: "Poppins", fill: "#1e3a8a", weight: "700", lineHeight: 1.05, name: "Title" }),
        text("Main Quad · 11 AM – 6 PM · Free entry", { left: w * 0.34, top: h * 0.64, size: Math.round(h * 0.035), font: "Inter", fill: "#475569", name: "Details" }),
      ];
    },
  },
  {
    id: "edu-achievement", title: "Student Achievement", theme: "education", format: "ig-story",
    keywords: ["education", "achievement", "congrats", "award"], background: "#1e3a8a",
    build({ width: w, height: h }) {
      const star = (cx, cy, r) => polygon(
        Array.from({ length: 10 }, (_, i) => {
          const ang = (Math.PI / 5) * i - Math.PI / 2;
          const rad = i % 2 === 0 ? r : r * 0.45;
          return { x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad };
        }),
        { fill: "#f59e0b", name: "Star" }
      );
      return [
        gradientBg(w, h, ["#1e40af", "#1e3a8a"], "vertical"),
        star(w / 2, h * 0.3, h * 0.07),
        text("CONGRATULATIONS", { left: w / 2, top: h * 0.42, originX: "center", size: Math.round(h * 0.03), font: "Poppins", fill: "#fcd34d", charSpacing: 400, weight: "700", name: "Kicker" }),
        text("Dean's List\n2026", { left: w / 2, top: h * 0.52, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.08), font: "Poppins", fill: "#ffffff", weight: "700", lineHeight: 1.05, name: "Headline" }),
        text("[ Student name ]", { left: w / 2, top: h * 0.66, originX: "center", size: Math.round(h * 0.035), font: "Inter", fill: "#bfdbfe", name: "Name" }),
      ];
    },
  },
  {
    id: "edu-online-class", title: "Online Class", theme: "education", format: "yt-thumbnail",
    keywords: ["education", "online", "class", "lecture"], background: "#ffffff",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#eff6ff"),
        rect({ left: 0, top: 0, width: w * 0.58, height: h, fill: "#1e40af", selectable: false, name: "Panel" }),
        text("LIVE CLASS", { left: w * 0.06, top: h * 0.18, size: Math.round(h * 0.045), font: "Poppins", fill: "#fcd34d", charSpacing: 300, weight: "700", name: "Kicker" }),
        text("Intro to\nCalculus", { left: w * 0.06, top: h * 0.32, size: Math.round(h * 0.18), font: "Poppins", fill: "#ffffff", weight: "700", lineHeight: 1, name: "Title" }),
        circle({ left: w * 0.74, top: h * 0.5, radius: h * 0.12, fill: "#f59e0b", name: "Play bg" }),
        triangle({ left: w * 0.76, top: h * 0.5, width: h * 0.1, height: h * 0.12, fill: "#ffffff", angle: 90, originX: "center", originY: "center", name: "Play" }),
        ...imageFrame({ x: w * 0.62, y: h * 0.66, w: w * 0.32, h: h * 0.24, fill: "#dbeafe", label: "Instructor" }),
      ];
    },
  },

  /* ===================== 7. SOCIAL / INFLUENCER ===================== */
  {
    id: "soc-new-post", title: "New Post Alert", theme: "social", format: "ig-post",
    keywords: ["social", "influencer", "post", "alert"], background: "#ff6b9d",
    build({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#ff6b9d", "#feca57"], "diagonal"),
        circle({ left: w * 0.5, top: h * 0.34, radius: h * 0.12, fill: "#ffffff", opacity: 0.25, name: "Halo" }),
        text("NEW\nPOST", { left: w / 2, top: h * 0.46, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.17), font: "Poppins", fill: "#ffffff", weight: "700", lineHeight: 0.95, name: "Headline" }),
        rect({ left: w / 2, top: h * 0.74, width: w * 0.46, height: h * 0.09, rx: h * 0.045, fill: "#111827", originX: "center", name: "Handle pill" }),
        text("@yourhandle", { left: w / 2, top: h * 0.785, originX: "center", originY: "center", size: Math.round(h * 0.034), font: "Poppins", fill: "#ffffff", weight: "600", name: "Handle" }),
      ];
    },
  },
  {
    id: "soc-link-bio", title: "Link in Bio", theme: "social", format: "ig-story",
    keywords: ["social", "story", "link", "swipe"], background: "#feca57",
    build({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#feca57", "#ff6b9d"], "vertical"),
        text("TAP THE\nLINK IN BIO", { left: w / 2, top: h * 0.4, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.075), font: "Poppins", fill: "#111827", weight: "700", lineHeight: 1.05, name: "Headline" }),
        circle({ left: w / 2, top: h * 0.68, radius: h * 0.05, fill: "#111827", name: "Arrow bg" }),
        triangle({ left: w / 2, top: h * 0.68, width: h * 0.045, height: h * 0.05, fill: "#ffffff", angle: 0, originX: "center", originY: "center", name: "Arrow" }),
        text("swipe up", { left: w / 2, top: h * 0.76, originX: "center", size: Math.round(h * 0.026), font: "Poppins", fill: "#111827", charSpacing: 200, name: "Hint" }),
      ];
    },
  },
  {
    id: "soc-carousel", title: "Carousel Cover", theme: "social", format: "ig-post",
    keywords: ["social", "carousel", "cover", "swipe", "tips"], background: "#111827",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#111827"),
        gradientRect({ left: 0, top: h * 0.78, width: w, height: h * 0.22 }, ["#ff6b9d", "#feca57"]),
        text("5 TIPS", { left: w * 0.08, top: h * 0.14, size: Math.round(h * 0.04), font: "Poppins", fill: "#feca57", charSpacing: 300, weight: "700", name: "Kicker" }),
        text("Grow your\naudience fast", { left: w * 0.08, top: h * 0.3, size: Math.round(h * 0.11), font: "Poppins", fill: "#ffffff", weight: "700", lineHeight: 1.05, name: "Headline" }),
        text("SWIPE →", { left: w * 0.08, top: h * 0.85, size: Math.round(h * 0.045), font: "Poppins", fill: "#111827", weight: "700", charSpacing: 200, name: "Swipe" }),
      ];
    },
  },
  {
    id: "soc-qa", title: "Q&A Sticker", theme: "social", format: "ig-story",
    keywords: ["social", "qa", "question", "engagement"], background: "#7c3aed",
    build({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#7c3aed", "#ff6b9d"], "diagonal"),
        text("ASK ME\nANYTHING", { left: w / 2, top: h * 0.32, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.07), font: "Poppins", fill: "#ffffff", weight: "700", lineHeight: 1.05, name: "Headline" }),
        rect({ left: w / 2, top: h * 0.52, width: w * 0.78, height: h * 0.14, rx: h * 0.03, fill: "#ffffff", originX: "center", name: "Question box" }),
        text("Type your question…", { left: w / 2, top: h * 0.59, originX: "center", originY: "center", size: Math.round(h * 0.028), font: "Inter", fill: "#9ca3af", name: "Placeholder" }),
      ];
    },
  },
  {
    id: "soc-giveaway", title: "Giveaway", theme: "social", format: "ig-post",
    keywords: ["social", "giveaway", "contest", "win"], background: "#ff6b9d",
    build({ width: w, height: h }) {
      const dots = [[0.12, 0.14, "#feca57"], [0.86, 0.2, "#ffffff"], [0.2, 0.84, "#ffffff"], [0.82, 0.8, "#feca57"]];
      const confetti = dots.map(([x, y, c], i) => circle({ left: w * x, top: h * y, radius: h * 0.02, fill: c, name: `Confetti ${i + 1}` }));
      return [
        gradientBg(w, h, ["#ff6b9d", "#7c3aed"], "diagonal"),
        ...confetti,
        text("GIVEAWAY", { left: w / 2, top: h * 0.4, originX: "center", originY: "center", size: Math.round(h * 0.13), font: "Poppins", fill: "#ffffff", weight: "700", name: "Headline" }),
        text("Follow + tag 2 friends to win", { left: w / 2, top: h * 0.56, originX: "center", size: Math.round(h * 0.035), font: "Poppins", fill: "#ffe4ef", name: "Rules" }),
        rect({ left: w / 2, top: h * 0.66, width: w * 0.4, height: h * 0.1, rx: h * 0.05, fill: "#111827", originX: "center", name: "Prize pill" }),
        text("WIN $200", { left: w / 2, top: h * 0.71, originX: "center", originY: "center", size: Math.round(h * 0.04), font: "Poppins", fill: "#feca57", weight: "700", name: "Prize" }),
      ];
    },
  },

  /* ======================= 8. NATURE / ORGANIC ======================= */
  {
    id: "nat-wellness", title: "Wellness Retreat", theme: "nature", format: "ig-post",
    keywords: ["nature", "wellness", "retreat", "organic"], background: "#e7e5d8",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#e7e5d8"),
        circle({ left: w * 0.5, top: h * 0.36, radius: h * 0.2, fill: "#3f6212", name: "Circle" }),
        text("breathe", { left: w / 2, top: h * 0.36, originX: "center", originY: "center", size: Math.round(h * 0.07), font: "Playfair Display", fill: "#e7e5d8", name: "Word" }),
        text("Wellness Retreat", { left: w / 2, top: h * 0.66, originX: "center", size: Math.round(h * 0.06), font: "Playfair Display", fill: "#3f6212", weight: "700", name: "Title" }),
        text("RESET · RESTORE · RENEW", { left: w / 2, top: h * 0.75, originX: "center", size: Math.round(h * 0.026), font: "Inter", fill: "#65a30d", charSpacing: 300, name: "Sub" }),
      ];
    },
  },
  {
    id: "nat-eco", title: "Eco Campaign", theme: "nature", format: "poster",
    keywords: ["nature", "eco", "sustainability", "green"], background: "#f0f4e8",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#f0f4e8"),
        polygon([{ x: w * 0.5, y: h * 0.08 }, { x: w * 0.68, y: h * 0.34 }, { x: w * 0.5, y: h * 0.3 }, { x: w * 0.32, y: h * 0.34 }], { fill: "#65a30d", name: "Leaf" }),
        line([w * 0.5, h * 0.3, w * 0.5, h * 0.42], { stroke: "#3f6212", strokeWidth: 4, name: "Stem" }),
        text("Plant a\nBetter Future", { left: w / 2, top: h * 0.56, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.09), font: "Playfair Display", fill: "#3f6212", weight: "700", lineHeight: 1.05, name: "Title" }),
        text("JOIN THE RE-GREEN MOVEMENT", { left: w / 2, top: h * 0.76, originX: "center", size: Math.round(h * 0.026), font: "Inter", fill: "#4d7c0f", charSpacing: 250, name: "Sub" }),
      ];
    },
  },
  {
    id: "nat-skincare", title: "Natural Skincare", theme: "nature", format: "ig-story",
    keywords: ["nature", "skincare", "beauty", "organic"], background: "#e7e5d8",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#e7e5d8"),
        ...imageFrame({ x: w * 0.2, y: h * 0.14, w: w * 0.6, h: h * 0.4, fill: "#cdd3bf", label: "Product", labelFill: "#6b7257", rx: w * 0.3 }),
        text("Pure.\nNatural.\nKind.", { left: w / 2, top: h * 0.68, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.06), font: "Playfair Display", fill: "#3f6212", lineHeight: 1.1, name: "Headline" }),
        text("ORGANIC SKINCARE", { left: w / 2, top: h * 0.82, originX: "center", size: Math.round(h * 0.022), font: "Inter", fill: "#65a30d", charSpacing: 300, name: "Sub" }),
      ];
    },
  },
  {
    id: "nat-market", title: "Farmers Market", theme: "nature", format: "fb-post",
    keywords: ["nature", "market", "farmers", "local"], background: "#3f6212",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#3f6212"),
        circle({ left: w * 0.82, top: h * 0.3, radius: h * 0.18, fill: "#84cc16", opacity: 0.5, name: "Sun" }),
        text("FARMERS", { left: w * 0.06, top: h * 0.24, size: Math.round(h * 0.16), font: "Playfair Display", fill: "#e7e5d8", weight: "700", name: "Head 1" }),
        text("MARKET", { left: w * 0.06, top: h * 0.46, size: Math.round(h * 0.16), font: "Playfair Display", fill: "#fcd34d", weight: "700", name: "Head 2" }),
        text("EVERY SUNDAY · 8AM – 1PM · TOWN SQUARE", { left: w * 0.06, top: h * 0.74, size: Math.round(h * 0.035), font: "Inter", fill: "#d9f99d", charSpacing: 100, name: "Details" }),
      ];
    },
  },
  {
    id: "nat-sustainability", title: "Sustainability Slide", theme: "nature", format: "presentation",
    keywords: ["nature", "sustainability", "slide", "green"], background: "#1a2e05",
    build({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#1a2e05", "#3f6212", "#65a30d"], "diagonal"),
        text("OUR 2030 PLEDGE", { left: w * 0.08, top: h * 0.26, size: Math.round(h * 0.03), font: "Inter", fill: "#d9f99d", charSpacing: 300, name: "Eyebrow" }),
        text("Carbon neutral,\nby design.", { left: w * 0.08, top: h * 0.4, originY: "center", size: Math.round(h * 0.1), font: "Playfair Display", fill: "#ffffff", weight: "700", lineHeight: 1.05, name: "Title" }),
        line([w * 0.08, h * 0.66, w * 0.2, h * 0.66], { stroke: "#84cc16", strokeWidth: 4, name: "Rule" }),
      ];
    },
  },

  /* ======================= 9. FOOD / LIFESTYLE ======================= */
  {
    id: "food-restaurant", title: "Restaurant Promo", theme: "food", format: "ig-post",
    keywords: ["food", "restaurant", "promo", "dish"], background: "#fff7ed",
    build({ width: w, height: h }) {
      return [
        solidBg(w, h, "#fff7ed"),
        ...imageFrame({ x: w * 0.5, y: 0, w: w * 0.5, h, fill: "#fed7aa", label: "Dish photo", labelFill: "#b45309" }),
        text("TASTE THE", { left: w * 0.06, top: h * 0.3, size: Math.round(h * 0.04), font: "Montserrat", fill: "#c2410c", charSpacing: 300, weight: "700", name: "Kicker" }),
        text("Flavor", { left: w * 0.06, top: h * 0.38, size: Math.round(h * 0.15), font: "Playfair Display", fill: "#7c2d12", weight: "700", name: "Headline" }),
        rect({ left: w * 0.06, top: h * 0.62, width: w * 0.32, height: h * 0.1, rx: h * 0.05, fill: "#c2410c", name: "CTA" }),
        text("Order now", { left: w * 0.06 + w * 0.16, top: h * 0.67, originX: "center", originY: "center", size: Math.round(h * 0.034), font: "Montserrat", fill: "#fff7ed", weight: "700", name: "CTA text" }),
      ];
    },
  },
  {
    id: "food-menu", title: "Menu Poster", theme: "food", format: "poster",
    keywords: ["food", "menu", "restaurant", "price"], background: "#fff7ed",
    build({ width: w, height: h }) {
      const items = [["Bruschetta", "$9"], ["Margherita", "$14"], ["Truffle Pasta", "$18"], ["Tiramisu", "$8"]];
      const rows = items.flatMap(([name, price], i) => {
        const y = h * (0.46 + i * 0.1);
        return [
          text(name, { left: w * 0.1, top: y, size: Math.round(h * 0.035), font: "Playfair Display", fill: "#7c2d12", name: `Item ${i + 1}` }),
          text(price, { left: w * 0.9, top: y, originX: "right", size: Math.round(h * 0.035), font: "Montserrat", fill: "#c2410c", weight: "700", name: `Price ${i + 1}` }),
          line([w * 0.1, y + h * 0.055, w * 0.9, y + h * 0.055], { stroke: "#f5d0b0", strokeWidth: 1, name: `Divider ${i + 1}` }),
        ];
      });
      return [
        solidBg(w, h, "#fff7ed"),
        text("MENU", { left: w / 2, top: h * 0.12, originX: "center", size: Math.round(h * 0.09), font: "Playfair Display", fill: "#7c2d12", weight: "700", charSpacing: 200, name: "Title" }),
        line([w * 0.4, h * 0.26, w * 0.6, h * 0.26], { stroke: "#c2410c", strokeWidth: 2, name: "Rule" }),
        text("OSTERIA · EST. 2019", { left: w / 2, top: h * 0.3, originX: "center", size: Math.round(h * 0.025), font: "Montserrat", fill: "#c2410c", charSpacing: 300, name: "Sub" }),
        ...rows,
      ];
    },
  },
  {
    id: "food-cafe", title: "Cafe Special", theme: "food", format: "ig-story",
    keywords: ["food", "cafe", "coffee", "special"], background: "#7c2d12",
    build({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#7c2d12", "#c2410c"], "vertical"),
        circle({ left: w / 2, top: h * 0.3, radius: h * 0.11, fill: "#fff7ed", name: "Cup" }),
        text("☕", { left: w / 2, top: h * 0.3, originX: "center", originY: "center", size: Math.round(h * 0.09), font: "Inter", fill: "#7c2d12", name: "Icon" }),
        text("MORNING\nSPECIAL", { left: w / 2, top: h * 0.5, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.08), font: "Playfair Display", fill: "#fff7ed", weight: "700", lineHeight: 1.05, name: "Headline" }),
        text("Any coffee + pastry · $6", { left: w / 2, top: h * 0.66, originX: "center", size: Math.round(h * 0.03), font: "Montserrat", fill: "#fde68a", name: "Offer" }),
      ];
    },
  },
  {
    id: "food-festival", title: "Food Festival", theme: "food", format: "fb-post",
    keywords: ["food", "festival", "event", "street"], background: "#c2410c",
    build({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#c2410c", "#ea580c", "#f59e0b"], "horizontal"),
        text("STREET FOOD", { left: w / 2, top: h * 0.22, originX: "center", size: Math.round(h * 0.055), font: "Montserrat", fill: "#fff7ed", charSpacing: 300, weight: "700", name: "Kicker" }),
        text("FESTIVAL", { left: w / 2, top: h * 0.38, originX: "center", originY: "center", size: Math.round(h * 0.2), font: "Playfair Display", fill: "#ffffff", weight: "700", name: "Headline" }),
        rect({ left: w / 2, top: h * 0.68, width: w * 0.5, height: h * 0.13, rx: h * 0.02, fill: "#7c2d12", originX: "center", name: "Date pill" }),
        text("JUNE 21–23 · RIVERSIDE PARK", { left: w / 2, top: h * 0.745, originX: "center", originY: "center", size: Math.round(h * 0.032), font: "Montserrat", fill: "#fde68a", weight: "700", name: "Details" }),
      ];
    },
  },
  {
    id: "food-recipe", title: "Recipe Card", theme: "food", format: "ig-post",
    keywords: ["food", "recipe", "cooking", "steps"], background: "#fffbeb",
    build({ width: w, height: h }) {
      const ings = ["2 cups flour", "3 eggs", "1 cup sugar", "Pinch of salt"];
      const list = ings.map((s, i) => text("• " + s, { left: w * 0.08, top: h * (0.55 + i * 0.08), size: Math.round(h * 0.03), font: "Inter", fill: "#78350f", name: `Ing ${i + 1}` }));
      return [
        solidBg(w, h, "#fffbeb"),
        ...imageFrame({ x: w * 0.08, y: h * 0.08, w: w * 0.84, h: h * 0.34, fill: "#fde68a", label: "Finished dish", labelFill: "#b45309" }),
        text("Classic Pancakes", { left: w * 0.08, top: h * 0.46, size: Math.round(h * 0.055), font: "Playfair Display", fill: "#7c2d12", weight: "700", name: "Title" }),
        ...list,
      ];
    },
  },

  /* ======================= 10. TECHNOLOGY / FUTURE ======================= */
  {
    id: "tech-ai-launch", title: "AI Product Launch", theme: "tech", format: "yt-thumbnail",
    keywords: ["tech", "ai", "launch", "neon", "future"], background: "#0b1020",
    build({ width: w, height: h }) {
      const gridH = Array.from({ length: 5 }, (_, i) => line([0, h * (0.2 * (i + 1)), w, h * (0.2 * (i + 1))], { stroke: "#1e293b", strokeWidth: 1, name: `Grid H${i}` }));
      return [
        gradientBg(w, h, ["#0b1020", "#111827", "#0b1020"], "diagonal"),
        ...gridH,
        text("MEET THE", { left: w * 0.06, top: h * 0.2, size: Math.round(h * 0.05), font: "Oswald", fill: "#22d3ee", charSpacing: 300, name: "Kicker" }),
        text("FUTURE\nOF AI", { left: w * 0.06, top: h * 0.32, size: Math.round(h * 0.22), font: "Oswald", fill: "#ffffff", weight: "700", lineHeight: 0.95, name: "Headline" }),
        gradientRect({ left: w * 0.06, top: h * 0.78, width: w * 0.3, height: h * 0.012 }, ["#22d3ee", "#7c3aed"]),
        ...imageFrame({ x: w * 0.62, y: h * 0.16, w: w * 0.32, h: h * 0.68, fill: "#0f172a", label: "Product", labelFill: "#38bdf8" }),
      ];
    },
  },
  {
    id: "tech-keynote", title: "Tech Keynote", theme: "tech", format: "presentation",
    keywords: ["tech", "keynote", "slide", "launch"], background: "#0b1020",
    build({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#0b1020", "#1e1b4b"], "diagonal"),
        gradientRect({ left: 0, top: h * 0.42, width: w * 0.14, height: h * 0.02 }, ["#22d3ee", "#7c3aed"]),
        text("KEYNOTE 2026", { left: w * 0.08, top: h * 0.26, size: Math.round(h * 0.03), font: "Oswald", fill: "#22d3ee", charSpacing: 400, name: "Eyebrow" }),
        text("Building What's\nNext", { left: w * 0.08, top: h * 0.46, size: Math.round(h * 0.11), font: "Oswald", fill: "#ffffff", weight: "700", lineHeight: 1.02, name: "Title" }),
        text("Platform · Cloud · Intelligence", { left: w * 0.08, top: h * 0.72, size: Math.round(h * 0.032), font: "Inter", fill: "#a5b4fc", name: "Sub" }),
      ];
    },
  },
  {
    id: "tech-app-launch", title: "App Launch", theme: "tech", format: "ig-post",
    keywords: ["tech", "app", "launch", "mobile"], background: "#0b1020",
    build({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#111827", "#0b1020"], "vertical"),
        rect({ left: w * 0.62, top: h * 0.18, width: w * 0.26, height: h * 0.64, rx: w * 0.03, fill: "#1e293b", stroke: "#22d3ee", strokeWidth: 2, name: "Phone" }),
        ...imageFrame({ x: w * 0.64, y: h * 0.21, w: w * 0.22, h: h * 0.58, fill: "#0f172a", label: "App UI", labelFill: "#38bdf8", rx: w * 0.02 }),
        text("NOW LIVE", { left: w * 0.08, top: h * 0.26, size: Math.round(h * 0.03), font: "Oswald", fill: "#22d3ee", charSpacing: 400, name: "Kicker" }),
        text("Your day,\nautomated.", { left: w * 0.08, top: h * 0.38, size: Math.round(h * 0.09), font: "Oswald", fill: "#ffffff", weight: "700", lineHeight: 1.02, name: "Headline" }),
        gradientRect({ left: w * 0.08, top: h * 0.64, width: w * 0.36, height: h * 0.09, rx: h * 0.045 }, ["#22d3ee", "#7c3aed"]),
        text("Download", { left: w * 0.08 + w * 0.18, top: h * 0.685, originX: "center", originY: "center", size: Math.round(h * 0.032), font: "Inter", fill: "#0b1020", weight: "700", name: "CTA text" }),
      ];
    },
  },
  {
    id: "tech-hackathon", title: "Hackathon Poster", theme: "tech", format: "poster",
    keywords: ["tech", "hackathon", "event", "code"], background: "#0b1020",
    build({ width: w, height: h }) {
      const grid = Array.from({ length: 6 }, (_, i) => line([w * (i / 6), 0, w * (i / 6), h], { stroke: "#131c33", strokeWidth: 1, name: `Grid ${i}` }));
      return [
        solidBg(w, h, "#0b1020"),
        ...grid,
        text("</>", { left: w / 2, top: h * 0.2, originX: "center", size: Math.round(h * 0.08), font: "Oswald", fill: "#22d3ee", name: "Glyph" }),
        text("HACK\nTHE FUTURE", { left: w / 2, top: h * 0.44, originX: "center", originY: "center", align: "center", size: Math.round(h * 0.11), font: "Oswald", fill: "#ffffff", weight: "700", lineHeight: 1, name: "Title" }),
        gradientRect({ left: w / 2, top: h * 0.66, width: w * 0.5, height: h * 0.09, rx: h * 0.045 }, ["#7c3aed", "#22d3ee"], "horizontal"),
        text("REGISTER · 48H · $10K PRIZE", { left: w / 2, top: h * 0.705, originX: "center", originY: "center", size: Math.round(h * 0.026), font: "Inter", fill: "#0b1020", weight: "700", charSpacing: 100, name: "CTA" }),
      ];
    },
  },
  {
    id: "tech-saas", title: "SaaS Announcement", theme: "tech", format: "fb-post",
    keywords: ["tech", "saas", "feature", "announcement"], background: "#0b1020",
    build({ width: w, height: h }) {
      const feats = ["Faster", "Secure", "AI-powered"];
      const pills = feats.map((f, i) => {
        const x = w * (0.06 + i * 0.22);
        return [
          rect({ left: x, top: h * 0.68, width: w * 0.19, height: h * 0.12, rx: h * 0.06, fill: "#111827", stroke: "#22d3ee", strokeWidth: 1.5, name: `Pill ${i + 1}` }),
          text(f, { left: x + w * 0.095, top: h * 0.74, originX: "center", originY: "center", size: Math.round(h * 0.035), font: "Inter", fill: "#e5e7eb", weight: "700", name: `Feat ${i + 1}` }),
        ];
      }).flat();
      return [
        gradientBg(w, h, ["#0b1020", "#1e1b4b", "#0b1020"], "horizontal"),
        text("INTRODUCING v2.0", { left: w * 0.06, top: h * 0.18, size: Math.round(h * 0.04), font: "Oswald", fill: "#22d3ee", charSpacing: 300, name: "Kicker" }),
        text("The upgrade\nyou asked for", { left: w * 0.06, top: h * 0.3, size: Math.round(h * 0.1), font: "Oswald", fill: "#ffffff", weight: "700", lineHeight: 1.02, name: "Headline" }),
        ...pills,
      ];
    },
  },
];
