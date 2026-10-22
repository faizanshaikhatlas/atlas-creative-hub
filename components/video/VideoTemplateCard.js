"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Clapperboard, ImageOff, Clock } from "lucide-react";
import { VIDEO_FORMATS } from "@/lib/video/formats";
import { renderVideoPoster } from "@/lib/video/preview";

function formatDur(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}:${String(r).padStart(2, "0")}` : `0:${String(r).padStart(2, "0")}`;
}

/**
 * Video starter card. The thumbnail is a GENUINE render of the starter's editable
 * opening frame (not a screenshot). "Preview" is live; "Use" is deferred to the
 * next checkpoint (the editor) — the handler surfaces an honest notice.
 */
export default function VideoTemplateCard({ template, onPreview, onUse }) {
  const ref = useRef(null);
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const fmt = VIDEO_FORMATS[template.format];
  const dims = fmt ? `${fmt.width} × ${fmt.height}` : null;

  useEffect(() => {
    let cancelled = false;
    const node = ref.current;
    const render = () => renderVideoPoster(template, 520).then((u) => !cancelled && setSrc(u)).catch(() => !cancelled && setFailed(true));
    if (!node || typeof IntersectionObserver === "undefined") { render(); return; }
    const io = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) { io.disconnect(); render(); } }, { rootMargin: "400px" });
    io.observe(node);
    return () => { cancelled = true; io.disconnect(); };
  }, [template]);

  return (
    <div ref={ref} className="group flex flex-col">
      <div className="relative w-full aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm transition group-hover:border-brand-300 group-hover:shadow-md group-focus-within:border-brand-300">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={template.title} className="absolute inset-0 h-full w-full object-contain p-2" loading="lazy" />
        ) : failed ? (
          <div className="flex h-full w-full items-center justify-center text-slate-500"><ImageOff size={22} /></div>
        ) : (
          <div className="h-full w-full animate-pulse bg-gradient-to-br from-slate-700 to-slate-900" />
        )}

        {template.durationSec != null && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            <Clock size={11} /> {formatDur(template.durationSec)}
          </span>
        )}

        <div className="pointer-events-none absolute inset-0 hidden items-center justify-center gap-2 bg-slate-900/45 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:flex">
          <button type="button" onClick={() => onPreview?.(template)}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <Eye size={14} /> Preview
          </button>
          <button type="button" onClick={() => onUse?.(template)}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300">
            <Clapperboard size={14} /> Use
          </button>
        </div>
      </div>

      <div className="mt-2 px-0.5">
        <p className="truncate text-[13px] font-medium text-slate-700" title={template.title}>{template.title}</p>
        {fmt && <p className="mt-0.5 text-right text-[11px] text-slate-400">{fmt.label} · {dims}</p>}
      </div>

      <div className="mt-1.5 flex gap-2 sm:hidden">
        <button type="button" onClick={() => onPreview?.(template)} className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600">Preview</button>
        <button type="button" onClick={() => onUse?.(template)} className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white">Use</button>
      </div>
    </div>
  );
}
