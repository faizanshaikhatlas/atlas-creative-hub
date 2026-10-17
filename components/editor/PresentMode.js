"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, Loader2, Play, Pause, Repeat } from "lucide-react";

/**
 * Fullscreen presentation of all pages. Renders each page to an image via the
 * controller's offscreen renderer (so the live editor canvas is untouched),
 * caches results, and navigates with arrows/space/click. Esc or ✕ exits.
 */
export default function PresentMode({ pages, startIndex = 0, controllerRef, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const [urls, setUrls] = useState({});
  const [playing, setPlaying] = useState(false);
  const [intervalSec, setIntervalSec] = useState(5);
  const [loop, setLoop] = useState(false);
  const [shown, setShown] = useState(true);
  const cacheRef = useRef({});
  const overlayRef = useRef(null);

  const renderAt = useCallback(
    async (i) => {
      if (i < 0 || i >= pages.length || cacheRef.current[i]) return;
      const c = controllerRef.current;
      if (!c) return;
      const pg = pages[i];
      const fit = Math.min(window.innerWidth / pg.width, window.innerHeight / pg.height);
      const mult = Math.min(2, Math.max(0.5, fit * (window.devicePixelRatio || 1)));
      try {
        const url = await c.renderPageJSON(pg.json, pg.width, pg.height, mult);
        cacheRef.current[i] = url;
        setUrls((u) => ({ ...u, [i]: url }));
      } catch {
        /* a page that fails to render just shows the spinner */
      }
    },
    [pages, controllerRef]
  );

  // Render current page + prefetch neighbours.
  useEffect(() => {
    renderAt(index);
    renderAt(index + 1);
    renderAt(index - 1);
  }, [index, renderAt]);

  const url = urls[index];

  // Fade each slide in when the page (or its rendered image) changes.
  useEffect(() => {
    setShown(false);
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [index, url]);

  // Auto-advance (play). Stops at the end unless looping.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setIndex((i) => {
        if (i >= pages.length - 1) {
          if (loop) return 0;
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, intervalSec * 1000);
    return () => clearInterval(id);
  }, [playing, intervalSec, loop, pages.length]);

  const next = useCallback(() => setIndex((i) => Math.min(pages.length - 1, i + 1)), [pages.length]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
      else if (e.key === "Escape") onClose();
      else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(pages.length - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose, pages.length]);

  // Try true fullscreen; harmless if the browser blocks it.
  useEffect(() => {
    const el = overlayRef.current;
    el?.requestFullscreen?.().catch(() => {});
    return () => {
      if (typeof document !== "undefined" && document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[60] bg-black">
      <div className="absolute inset-0 flex cursor-pointer items-center justify-center p-4" onClick={next}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`Page ${index + 1}`}
            className={`max-h-full max-w-full object-contain shadow-2xl transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
          />
        ) : (
          <Loader2 size={30} className="animate-spin text-white/70" />
        )}
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); prev(); }}
        disabled={index === 0}
        aria-label="Previous page"
        className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-20"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); next(); }}
        disabled={index === pages.length - 1}
        aria-label="Next page"
        className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-20"
      >
        <ChevronRight size={22} />
      </button>

      <div
        className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 text-white backdrop-blur"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20">
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <span className="px-1 text-sm tabular-nums">{index + 1} / {pages.length}</span>
        <select
          value={intervalSec}
          onChange={(e) => setIntervalSec(Number(e.target.value))}
          aria-label="Seconds per slide"
          className="rounded bg-white/10 px-1 py-0.5 text-xs text-white outline-none"
        >
          <option className="text-slate-800" value={3}>3s</option>
          <option className="text-slate-800" value={5}>5s</option>
          <option className="text-slate-800" value={10}>10s</option>
        </select>
        <button
          type="button"
          onClick={() => setLoop((l) => !l)}
          aria-label="Toggle loop"
          title="Loop"
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20 ${loop ? "bg-white/25" : ""}`}
        >
          <Repeat size={15} />
        </button>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Exit presentation"
        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <X size={20} />
      </button>
    </div>
  );
}
