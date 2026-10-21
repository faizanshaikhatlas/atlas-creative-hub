"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { apiGetProject } from "@/lib/designs/client";
import { renderDesignPreview } from "@/lib/designs/renderPreview";

// In-memory preview cache keyed by id + last-edited time, so a card re-renders
// only when the design actually changes (edit → new updatedAt → new key).
const previewCache = new Map();

/**
 * Render a saved design's cover preview from its document (page 0), lazily (only
 * once scrolled into view) and cached. Falls back to a neutral placeholder while
 * loading or if the preview can't be produced — never shows another design.
 */
export default function DesignThumb({ project, userId }) {
  const key = `${project.id}@${project.updatedAt || 0}`;
  const ref = useRef(null);
  const [src, setSrc] = useState(() => previewCache.get(key) || null);
  const [state, setState] = useState(() => (previewCache.get(key) ? "ready" : "idle")); // idle|loading|ready|failed

  useEffect(() => {
    const cached = previewCache.get(key);
    if (cached) { setSrc(cached); setState("ready"); return; }
    setSrc(null);
    setState("idle");

    const node = ref.current;
    let cancelled = false;
    const run = async () => {
      setState("loading");
      try {
        // Load the design (images resolved to fresh signed URLs here, so expired
        // URLs are never used), then render page 0 from the document.
        const full = await apiGetProject(project.id, userId);
        const page = full.pages && full.pages[0];
        const url = await renderDesignPreview(page, 520);
        if (cancelled) return;
        if (url) { previewCache.set(key, url); setSrc(url); setState("ready"); }
        else setState("failed");
      } catch {
        if (!cancelled) setState("failed");
      }
    };

    if (!node || typeof IntersectionObserver === "undefined") { run(); return; }
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) { io.disconnect(); run(); } },
      { rootMargin: "300px" }
    );
    io.observe(node);
    return () => { cancelled = true; io.disconnect(); };
  }, [key, project.id, userId]);

  return (
    <div ref={ref} className="h-full w-full">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={project.name || "Design preview"} className="h-full w-full object-contain" />
      ) : state === "failed" ? (
        <div className="flex h-full w-full items-center justify-center text-slate-300"><ImageOff size={26} /></div>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-300"><Loader2 size={18} className="animate-spin" /></div>
      )}
    </div>
  );
}
