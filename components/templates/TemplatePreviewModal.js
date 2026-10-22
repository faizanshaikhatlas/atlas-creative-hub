"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Sparkles } from "lucide-react";
import { FORMATS, renderTemplateThumbnail, buildTemplateDesign } from "@/lib/template-catalog";
import { apiCreateProject } from "@/lib/designs/client";
import { recordTemplateView } from "@/lib/template-catalog/recentlyViewed";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Shared larger-preview modal for a template. Preview-only (creates no record);
 * "Use template" is auth-gated and creates an independent copy in the signed-in
 * user's account via the existing API workflow. Reused by both the Templates
 * gallery and the home page so preview behavior is identical everywhere.
 */
export default function TemplatePreviewModal({ template, onClose, onError }) {
  const router = useRouter();
  const { configured, user, active } = useAuth();
  const [src, setSrc] = useState(null);
  const [creating, setCreating] = useState(false);
  const fmt = FORMATS[template.format];

  useEffect(() => {
    let cancelled = false;
    renderTemplateThumbnail(template, 1100).then((u) => !cancelled && setSrc(u)).catch(() => {});
    return () => { cancelled = true; };
  }, [template]);

  async function use() {
    recordTemplateView(template.id); // device-local recents (no sensitive data)
    if (!configured) { onError?.("Cloud is not configured for this deployment."); onClose(); return; }
    if (!user) { router.push(`/login?next=${encodeURIComponent("/templates")}`); return; }
    if (!active) { onError?.("Your account is awaiting administrator approval before you can create designs."); onClose(); return; }
    setCreating(true);
    try {
      const payload = await buildTemplateDesign(template);
      const res = await apiCreateProject(payload, user.id);
      router.push(`/editor/${res.id}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
      onError?.(e?.status === 403 ? "Your account is awaiting approval." : "Could not create a design from this template.");
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">{template.title}</p>
            {fmt && <p className="text-xs text-slate-400">{fmt.label} · {fmt.width}×{fmt.height}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-50 p-4">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={template.title} className="max-h-[62dvh] w-auto max-w-full rounded-lg shadow" />
          ) : (
            <Loader2 size={24} className="animate-spin text-slate-300" />
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">Close</button>
          <button onClick={use} disabled={creating} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Use template
          </button>
        </div>
      </div>
    </div>
  );
}
