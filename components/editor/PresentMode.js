"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, Loader2, Play, Pause, Repeat, RotateCcw } from "lucide-react";

/**
 * Fullscreen presentation of all pages. Each page is rendered (off the live
 * canvas) into a stack of full-size transparent layers — one per object — so
 * objects with an entrance animation can fly in individually while z-order and
 * alignment stay pixel-exact. Pages with no animated object come back as a
 * single flattened layer. Navigate with arrows/space/click; Esc or ✕ exits.
 */

const KEYFRAME = { fade: "dsFade", rise: "dsRise", pop: "dsPop", slide: "dsSlide" };

function layerStyle(anim, animIndex, speed = 1) {
  if (anim === "none") {
    // Base + static objects: a gentle fade so slides don't pop harshly.
    return { animation: `dsFade ${Math.round(300 * speed)}ms ease-out both` };
  }
  const name = KEYFRAME[anim] || "dsFade";
  const delay = Math.round((150 + animIndex * 220) * speed);
  const dur = Math.round(520 * speed);
  return { animation: `${name} ${dur}ms cubic-bezier(.2,.7,.2,1) both`, animationDelay: `${delay}ms` };
}

export default function PresentMode({ pages, startIndex = 0, controllerRef, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const [layersByIndex, setLayersByIndex] = useState({});
  const [playing, setPlaying] = useState(false);
  const [intervalSec, setIntervalSec] = useState(5);
  const [loop, setLoop] = useState(false);
  const [animSpeed, setAnimSpeed] = useState(1); // 0.6 fast · 1 normal · 1.6 slow
  const [replayNonce, setReplayNonce] = useState(0);
  const [vp, setVp] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 720,
  }));
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
        const layers = await c.renderPageLayers(pg.json, pg.width, pg.height, mult);
        cacheRef.current[i] = layers;
        setLayersByIndex((m) => ({ ...m, [i]: layers }));
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

  // Track viewport so the slide (and its layers) keep the page aspect ratio.
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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

  const pg = pages[index];
  const layers = layersByIndex[index];
  const pad = 32;
  const scale = pg ? Math.min((vp.w - pad) / pg.width, (vp.h - pad) / pg.height) : 1;
  const dispW = pg ? Math.max(1, Math.round(pg.width * scale)) : 1;
  const dispH = pg ? Math.max(1, Math.round(pg.height * scale)) : 1;

  // Assign a stagger order to each animated layer as we render them.
  let animCount = 0;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[60] bg-black">
      <style>{`
        @keyframes dsFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dsRise { from { opacity: 0; transform: translateY(6%) } to { opacity: 1; transform: none } }
        @keyframes dsPop { from { opacity: 0; transform: scale(.6) } to { opacity: 1; transform: none } }
        @keyframes dsSlide { from { opacity: 0; transform: translateX(-8%) } to { opacity: 1; transform: none } }
      `}</style>

      <div className="absolute inset-0 flex cursor-pointer items-center justify-center p-4" onClick={next}>
        {layers ? (
          <div
            key={`slide-${index}-${replayNonce}`}
            className="relative shadow-2xl"
            style={{ width: dispW, height: dispH }}
          >
            {layers.map((l, li) => {
              const animIndex = l.anim !== "none" ? animCount++ : 0;
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={li}
                  src={l.url}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-contain"
                  style={layerStyle(l.anim, animIndex, animSpeed)}
                />
              );
            })}
          </div>
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
        <span className="mx-0.5 h-5 w-px bg-white/20" />
        <button
          type="button"
          onClick={() => setReplayNonce((n) => n + 1)}
          aria-label="Replay animations"
          title="Replay animations"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20"
        >
          <RotateCcw size={15} />
        </button>
        <select
          value={animSpeed}
          onChange={(e) => setAnimSpeed(Number(e.target.value))}
          aria-label="Animation speed"
          title="Animation speed"
          className="rounded bg-white/10 px-1 py-0.5 text-xs text-white outline-none"
        >
          <option className="text-slate-800" value={0.6}>Fast</option>
          <option className="text-slate-800" value={1}>Normal</option>
          <option className="text-slate-800" value={1.6}>Slow</option>
        </select>
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
