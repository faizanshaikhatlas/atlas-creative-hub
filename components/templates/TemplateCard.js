"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, Sparkles, ImageOff } from "lucide-react";
import { FORMATS, renderTemplateThumbnail, buildTemplateDesign } from "@/lib/template-catalog";
import { apiCreateProject } from "@/lib/designs/client";
import { useAuth } from "@/components/auth/AuthProvider";

export default function TemplateCard({ template, onPreview, onError }) {
  const router = useRouter();
  const { configured, user, active } = useAuth();
  const ref = useRef(null);
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const fmt = FORMATS[template.format];
  // Real original dimensions from the template's format metadata (never invented).
  const dims = fmt ? `${fmt.width} × ${fmt.height}` : null;

  useEffect(() => {
    let cancelled = false;
    const node = ref.current;
    const render = () =>
      renderTemplateThumbnail(template, 520)
        .then((u) => !cancelled && setSrc(u))
        .catch(() => !cancelled && setFailed(true));
    if (!node || typeof IntersectionObserver === "undefined") { render(); return; }
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) { io.disconnect(); render(); } },
      { rootMargin: "400px" }
    );
    io.observe(node);
    return () => { cancelled = true; io.disconnect(); };
  }, [template]);

  async function use() {
    if (!configured) { onError?.("Cloud is not configured for this deployment."); return; }
    if (!user) { router.push(`/login?next=${encodeURIComponent("/templates")}`); return; }
    if (!active) { onError?.("Your account is awaiting administrator approval before you can create designs."); return; }
    setCreating(true);
    try {
      const payload = await buildTemplateDesign(template);
      const res = await apiCreateProject(payload, user.id);
      router.push(`/editor/${res.id}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
      onError?.(e?.status === 403 ? "Your account is awaiting approval." : "Could not create a design from this template.");
    }
  }

  return (
    <div ref={ref} className="group flex flex-col">
      {/* Uniform 4:3 preview container for EVERY format. The design is scaled
          with object-contain (never cropped/stretched) and centred on a neutral
          background, so portrait/square/landscape templates all occupy equal cards. */}
      <div className="relative w-full aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm transition group-hover:border-brand-300 group-hover:shadow-md group-focus-within:border-brand-300">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={template.title} className="absolute inset-0 h-full w-full object-contain p-2" loading="lazy" />
        ) : failed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-300">
            <ImageOff size={22} />
          </div>
        ) : (
          <div className="h-full w-full animate-pulse bg-gradient-to-br from-slate-100 to-slate-200" />
        )}

        {/* Canva-style hover/focus overlay (desktop + keyboard). The design stays
            visible behind a subtle dim; touch devices use the buttons below. */}
        <div className="pointer-events-none absolute inset-0 hidden items-center justify-center gap-2 bg-slate-900/45 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:flex">
          <button type="button" onClick={() => onPreview?.(template)}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <Eye size={14} /> Preview
          </button>
          <button type="button" onClick={use} disabled={creating}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:opacity-60">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Use template
          </button>
        </div>
      </div>

      <div className="mt-2 px-0.5">
        <p className="truncate text-[13px] font-medium text-slate-700" title={template.title}>{template.title}</p>
        {fmt && (
          <p className="mt-0.5 text-right text-[11px] text-slate-400">{fmt.label} · {dims}</p>
        )}
      </div>

      <div className="mt-1.5 flex gap-2 sm:hidden">
        <button type="button" onClick={() => onPreview?.(template)} className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600">Preview</button>
        <button type="button" onClick={use} disabled={creating} className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{creating ? "…" : "Use"}</button>
      </div>
    </div>
  );
}
