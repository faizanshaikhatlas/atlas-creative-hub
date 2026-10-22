// ATLAS original video starter templates. Each is ORIGINAL (no Canva assets) and
// editable: `poster({width,height})` returns editable Fabric objects for the
// opening frame (rendered to a real preview thumbnail). The media slot is an
// editable image frame — the user drops their own clip/photo there in the editor.
// `durationSec` + `format.fps` seed the timeline document built in a later
// checkpoint; browsing/previewing here creates NO record.

import { solidBg, gradientBg, gradientRect, rect, text, imageFrame } from "@/lib/template-catalog/helpers";

export const VIDEO_TEMPLATES = [
  {
    id: "yt-intro-bold", title: "Bold YouTube Intro", format: "yt-video",
    categories: ["youtube", "intros"], keywords: ["youtube", "intro", "channel", "subscribe", "opener"],
    durationSec: 8, background: "#0a0a12",
    poster({ width: w, height: h }) {
      return [
        solidBg(w, h, "#0a0a12"),
        gradientRect({ left: 0, top: 0, width: w * 0.46, height: h }, ["#4f46e5", "#0a0a12"], "horizontal"),
        rect({ left: w * 0.08, top: h * 0.34, width: w * 0.06, height: 8, fill: "#818cf8", name: "Accent" }),
        text("YOUR CHANNEL", { left: w * 0.08, top: h * 0.4, size: Math.round(h * 0.13), font: "Bebas Neue", fill: "#ffffff", name: "Headline" }),
        text("New videos every week", { left: w * 0.08, top: h * 0.6, size: Math.round(h * 0.045), font: "Montserrat", fill: "#c7d2fe", name: "Subtitle" }),
        ...imageFrame({ x: w * 0.6, y: h * 0.22, w: w * 0.32, h: h * 0.56, fill: "#14142b", label: "Your clip", labelFill: "#6b7280", rx: 18 }),
      ];
    },
  },
  {
    id: "yt-explainer", title: "Business Explainer", format: "yt-video",
    categories: ["youtube", "business", "intros"], keywords: ["business", "explainer", "corporate", "how it works", "presentation"],
    durationSec: 10, background: "#f8fafc",
    poster({ width: w, height: h }) {
      return [
        solidBg(w, h, "#f8fafc"),
        rect({ left: 0, top: 0, width: w, height: h * 0.16, fill: "#4f46e5", name: "Top bar" }),
        text("How it works", { left: w * 0.07, top: h * 0.04, size: Math.round(h * 0.07), font: "Poppins", weight: "700", fill: "#ffffff", name: "Brand" }),
        text("Three simple steps to get started", { left: w * 0.07, top: h * 0.3, size: Math.round(h * 0.06), font: "Poppins", weight: "700", fill: "#0f172a", name: "Headline" }),
        text("01  Sign up    02  Build    03  Share", { left: w * 0.07, top: h * 0.46, size: Math.round(h * 0.042), font: "Inter", fill: "#475569", name: "Steps" }),
        ...imageFrame({ x: w * 0.07, y: h * 0.58, w: w * 0.86, h: h * 0.3, fill: "#e2e8f0", label: "Your clip or screen recording", labelFill: "#94a3b8", rx: 16 }),
      ];
    },
  },
  {
    id: "edu-lesson", title: "Lesson Intro", format: "yt-video",
    categories: ["youtube", "education", "intros"], keywords: ["education", "lesson", "course", "teaching", "class"],
    durationSec: 8, background: "#0f2740",
    poster({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#0f2740", "#1e3a5f"], "diagonal"),
        rect({ left: w * 0.08, top: h * 0.22, width: w * 0.22, height: h * 0.1, rx: 10, fill: "#f59e0b", name: "Badge" }),
        text("LESSON 01", { left: w * 0.1, top: h * 0.245, size: Math.round(h * 0.05), font: "Oswald", weight: "700", fill: "#0f2740", name: "Badge text" }),
        text("Introduction to\nthe Course", { left: w * 0.08, top: h * 0.42, size: Math.round(h * 0.1), font: "Playfair Display", weight: "700", fill: "#ffffff", lineHeight: 1.05, name: "Headline" }),
        text("Your name · Department", { left: w * 0.08, top: h * 0.78, size: Math.round(h * 0.04), font: "Inter", fill: "#cbd5e1", name: "Byline" }),
      ];
    },
  },
  {
    id: "reel-promo", title: "Reel Product Promo", format: "ig-reel",
    categories: ["instagram-reels", "ads"], keywords: ["reel", "promo", "product", "sale", "new", "launch"],
    durationSec: 15, background: "#1a0b2e",
    poster({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#ec4899", "#7c3aed"], "vertical"),
        ...imageFrame({ x: w * 0.1, y: h * 0.12, w: w * 0.8, h: h * 0.42, fill: "#2a1140", label: "Your product clip", labelFill: "#e9d5ff", rx: 24 }),
        text("NEW DROP", { left: w / 2, top: h * 0.62, originX: "center", size: Math.round(h * 0.07), font: "Anton", fill: "#ffffff", name: "Headline" }),
        text("Swipe up to shop", { left: w / 2, top: h * 0.7, originX: "center", size: Math.round(h * 0.03), font: "Montserrat", fill: "#f5d0fe", charSpacing: 200, name: "Subtitle" }),
        rect({ left: w / 2, top: h * 0.78, width: w * 0.42, height: h * 0.07, rx: 40, fill: "#ffffff", originX: "center", name: "Button" }),
        text("SHOP NOW", { left: w / 2, top: h * 0.795, originX: "center", size: Math.round(h * 0.03), font: "Montserrat", weight: "700", fill: "#7c3aed", name: "Button text" }),
      ];
    },
  },
  {
    id: "tiktok-hook", title: "TikTok Hook", format: "tiktok",
    categories: ["tiktok", "ads"], keywords: ["tiktok", "hook", "trend", "viral", "story"],
    durationSec: 12, background: "#000000",
    poster({ width: w, height: h }) {
      return [
        solidBg(w, h, "#050505"),
        ...imageFrame({ x: 0, y: 0, w, h, fill: "#111111", label: "Your clip (full screen)", labelFill: "#555", rx: 0 }),
        rect({ left: 0, top: h * 0.36, width: w, height: h * 0.2, fill: "rgba(0,0,0,0.45)", name: "Scrim" }),
        text("WAIT FOR IT…", { left: w / 2, top: h * 0.4, originX: "center", size: Math.round(h * 0.06), font: "Anton", fill: "#ffffff", name: "Hook" }),
        text("Part 1 of 3", { left: w / 2, top: h * 0.49, originX: "center", size: Math.round(h * 0.028), font: "Montserrat", fill: "#22d3ee", charSpacing: 200, name: "Tag" }),
      ];
    },
  },
  {
    id: "reel-story", title: "Story Highlights", format: "ig-reel",
    categories: ["instagram-reels", "intros"], keywords: ["story", "highlights", "recap", "aesthetic", "soft"],
    durationSec: 12, background: "#fdf2f8",
    poster({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#fde68a", "#fbcfe8", "#ddd6fe"], "diagonal"),
        text("the\nhighlights", { left: w / 2, top: h * 0.3, originX: "center", align: "center", size: Math.round(h * 0.11), font: "Playfair Display", weight: "700", fill: "#4c1d95", lineHeight: 1, name: "Headline" }),
        ...imageFrame({ x: w * 0.16, y: h * 0.5, w: w * 0.68, h: h * 0.34, fill: "#ffffff", label: "Your photo or clip", labelFill: "#a78bfa", rx: 20 }),
        text("2026 · recap", { left: w / 2, top: h * 0.88, originX: "center", size: Math.round(h * 0.03), font: "Montserrat", fill: "#6d28d9", charSpacing: 300, name: "Caption" }),
      ];
    },
  },
  {
    id: "fb-ad", title: "Facebook Promo", format: "fb-video",
    categories: ["facebook", "ads", "business"], keywords: ["facebook", "ad", "promo", "offer", "cta", "business"],
    durationSec: 10, background: "#ffffff",
    poster({ width: w, height: h }) {
      return [
        solidBg(w, h, "#ffffff"),
        rect({ left: 0, top: 0, width: w * 0.42, height: h, fill: "#1d4ed8", name: "Panel" }),
        text("Limited\nTime Offer", { left: w * 0.05, top: h * 0.28, size: Math.round(h * 0.11), font: "Oswald", weight: "700", fill: "#ffffff", lineHeight: 1, name: "Headline" }),
        rect({ left: w * 0.05, top: h * 0.64, width: w * 0.26, height: h * 0.12, rx: 8, fill: "#f59e0b", name: "Button" }),
        text("LEARN MORE", { left: w * 0.075, top: h * 0.675, size: Math.round(h * 0.04), font: "Montserrat", weight: "700", fill: "#1d4ed8", name: "Button text" }),
        ...imageFrame({ x: w * 0.47, y: h * 0.12, w: w * 0.48, h: h * 0.76, fill: "#e2e8f0", label: "Your clip", labelFill: "#94a3b8", rx: 14 }),
      ];
    },
  },
  {
    id: "square-sale", title: "Square Sale", format: "square",
    categories: ["ads", "instagram-reels"], keywords: ["sale", "discount", "square", "promo", "shop"],
    durationSec: 8, background: "#7c2d12",
    poster({ width: w, height: h }) {
      return [
        gradientBg(w, h, ["#ea580c", "#7c2d12"], "diagonal"),
        text("SALE", { left: w / 2, top: h * 0.2, originX: "center", size: Math.round(h * 0.2), font: "Anton", fill: "#ffffff", name: "Headline" }),
        text("UP TO 50% OFF", { left: w / 2, top: h * 0.44, originX: "center", size: Math.round(h * 0.06), font: "Montserrat", weight: "700", fill: "#ffedd5", charSpacing: 200, name: "Subhead" }),
        ...imageFrame({ x: w * 0.26, y: h * 0.56, w: w * 0.48, h: h * 0.3, fill: "#fff7ed", label: "Your product", labelFill: "#fb923c", rx: 16 }),
      ];
    },
  },
];

// Curated "Popular" row — a strong spread of formats/categories.
export const FEATURED_VIDEO_IDS = ["yt-intro-bold", "reel-promo", "tiktok-hook", "fb-ad", "square-sale", "edu-lesson"];
