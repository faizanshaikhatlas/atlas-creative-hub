"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Clapperboard } from "lucide-react";
import { VIDEO_FORMATS } from "@/lib/video/formats";
import { renderVideoPoster } from "@/lib/video/preview";

/**
 * Larger preview of a video starter's editable opening frame. Preview-only
 * (creates no record). "Use template" is deferred to the editor checkpoint — the
 * handler surfaces an honest notice rather than pretending to create a project.
 */
export default function VideoPreviewModal({ template, onClose, onUse }) {
  const [src, setSrc] = useState(null);
  const fmt = VIDEO_FORMATS[template.format];

  useEffect(() => {
    let cancelled = false;
    renderVideoPoster(template, 1100).then((u) => !cancelled && setSrc(u)).catch(() => {});
    return () => { cancelled = true; };
  }, [template]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">{template.title}</p>
            {fmt && <p className="text-xs text-slate-400">{fmt.label} · {fmt.width}×{fmt.height} · {fmt.aspect} · {template.durationSec}s</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-900 p-4">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={template.title} className="max-h-[58dvh] w-auto max-w-full rounded-lg shadow" />
          ) : (
            <Loader2 size={24} className="animate-spin text-slate-500" />
          )}
        </div>
        <div className="border-t border-slate-100 p-4">
          <p className="mb-3 text-xs text-slate-500">
            This preview is the <strong>editable opening frame</strong>. The labelled frame is where you drop your own clip or photo once the video editor is available.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">Close</button>
            <button onClick={() => onUse?.(template)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              <Clapperboard size={14} /> Use template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
