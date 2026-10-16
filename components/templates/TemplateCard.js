"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, Sparkles } from "lucide-react";
import { FORMATS, THEME_BY_ID, renderTemplateThumbnail, createDesignFromTemplate } from "@/lib/template-catalog";

export default function TemplateCard({ template, onPreview, onError }) {
  const router = useRouter();
  const ref = useRef(null);
  const [src, setSrc] = useState(null);
  const [creating, setCreating] = useState(false);
  const fmt = FORMATS[template.format];
  const theme = THEME_BY_ID[template.theme];

  useEffect(() => {
    let cancelled = false;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      renderTemplateThumbnail(template, 480).then((u) => !cancelled && setSrc(u)).catch(() => {});
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          io.disconnect();
          renderTemplateThumbnail(template, 480).then((u) => !cancelled && setSrc(u)).catch(() => {});
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(node);
    return () => { cancelled = true; io.disconnect(); };
  }, [template]);

  async function use() {
    setCreating(true);
    try {
      const id = await createDesignFromTemplate(template);
      router.push(`/editor/${id}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
      onError?.("Could not create a design from this template.");
    }
  }

  return (
    <div
      ref={ref}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-brand-400 hover:shadow-md"
    >
      <div className="relative w-full overflow-hidden bg-slate-100" style={{ aspectRatio: `${fmt.width} / ${fmt.height}` }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={template.title} className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}
        {/* Hover actions (desktop) */}
        <div className="pointer-events-none absolute inset-0 hidden items-center justify-center gap-2 bg-slate-900/40 opacity-0 transition group-hover:opacity-100 sm:flex">
          <button
            type="button"
            onClick={() => onPreview?.(template)}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow hover:bg-white"
          >
            <Eye size={14} /> Preview
          </button>
          <button
            type="button"
            onClick={use}
            disabled={creating}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-60"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Use template
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-800" title={template.title}>{template.title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
            style={{ background: theme?.swatch?.[1] || "#6366f1" }}
          >
            {theme?.name?.split(" ")[0] || template.theme}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            {fmt.short}
          </span>
          <span className="text-[10px] text-slate-400">{fmt.width}×{fmt.height}</span>
        </div>
        {/* Mobile actions */}
        <div className="mt-1 flex gap-2 sm:hidden">
          <button type="button" onClick={() => onPreview?.(template)} className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600">Preview</button>
          <button type="button" onClick={use} disabled={creating} className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            {creating ? "…" : "Use"}
          </button>
        </div>
      </div>
    </div>
  );
}
