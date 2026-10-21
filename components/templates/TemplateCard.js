"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, Sparkles, ImageOff } from "lucide-react";
import { FORMATS, THEME_BY_ID, renderTemplateThumbnail, buildTemplateDesign } from "@/lib/template-catalog";
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
  const theme = THEME_BY_ID[template.theme];

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
      <div
        className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm transition group-hover:border-brand-300 group-hover:shadow-md"
        style={{ aspectRatio: `${fmt.width} / ${fmt.height}` }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={template.title} className="h-full w-full object-cover" loading="lazy" />
        ) : failed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-300" style={{ background: theme?.swatch?.[0] }}>
            <ImageOff size={22} />
          </div>
        ) : (
          <div className="h-full w-full animate-pulse bg-gradient-to-br from-slate-100 to-slate-200" />
        )}

        <div className="pointer-events-none absolute inset-0 hidden items-center justify-center gap-2 bg-slate-900/45 opacity-0 transition group-hover:opacity-100 sm:flex">
          <button type="button" onClick={() => onPreview?.(template)}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow hover:bg-white">
            <Eye size={14} /> Preview
          </button>
          <button type="button" onClick={use} disabled={creating}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-60">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Use
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
        <p className="truncate text-[13px] font-medium text-slate-700" title={template.title}>{template.title}</p>
        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{fmt.short}</span>
      </div>

      <div className="mt-1.5 flex gap-2 sm:hidden">
        <button type="button" onClick={() => onPreview?.(template)} className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600">Preview</button>
        <button type="button" onClick={use} disabled={creating} className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{creating ? "…" : "Use"}</button>
      </div>
    </div>
  );
}
