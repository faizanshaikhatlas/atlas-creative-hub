"use client";

import { useEffect, useState } from "react";
import { Palette, ImagePlus, ArrowRight } from "lucide-react";
import { listBrandKits, listUploads } from "@/lib/db/projects";

/**
 * Home discoverability for the EXISTING Brand Kit and Uploads features. It does
 * not replace them — they're edited inside a design (Brand / Uploads panels) and
 * stored on this device per the existing implementation. This surfaces what the
 * signed-in account already has and points to where they're used.
 */
export default function HomeBrandUploads({ onUse }) {
  const [kits, setKits] = useState(null);
  const [uploads, setUploads] = useState(null);

  useEffect(() => {
    let alive = true;
    listBrandKits().then((k) => alive && setKits(k || [])).catch(() => alive && setKits([]));
    listUploads().then((u) => alive && setUploads(u || [])).catch(() => alive && setUploads([]));
    return () => { alive = false; };
  }, []);

  const kitColors = (kits && kits[0] && Array.isArray(kits[0].colors) ? kits[0].colors : []).slice(0, 6);
  const uploadThumbs = (uploads || []).slice(0, 4);

  return (
    <section className="mb-12">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Brand &amp; uploads</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Brand Kit */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700"><Palette size={17} /></span>
            <div>
              <p className="text-sm font-semibold text-slate-800">Brand Kit</p>
              <p className="text-[11px] text-slate-400">
                {kits === null ? "Loading…" : kits.length ? `${kits.length} saved on this device` : "No brand kits yet"}
              </p>
            </div>
          </div>
          {kitColors.length > 0 && (
            <div className="mt-3 flex gap-1.5">
              {kitColors.map((c, i) => (
                <span key={i} className="h-5 w-5 rounded-full border border-slate-200" style={{ background: c }} title={c} />
              ))}
            </div>
          )}
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Reusable brand colors, fonts, and logos. Manage them in the <strong>Brand</strong> panel inside any design.
          </p>
          <button type="button" onClick={onUse}
            className="mt-3 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
            Use in a design <ArrowRight size={14} />
          </button>
        </div>

        {/* Uploads */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700"><ImagePlus size={17} /></span>
            <div>
              <p className="text-sm font-semibold text-slate-800">Uploads</p>
              <p className="text-[11px] text-slate-400">
                {uploads === null ? "Loading…" : uploads.length ? `${uploads.length} image${uploads.length === 1 ? "" : "s"} on this device` : "No uploads yet"}
              </p>
            </div>
          </div>
          {uploadThumbs.length > 0 && (
            <div className="mt-3 flex gap-1.5">
              {uploadThumbs.map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u.id} src={u.dataUrl} alt={u.name || "Upload"} className="h-10 w-10 rounded-md border border-slate-200 object-cover" />
              ))}
            </div>
          )}
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Your uploaded images appear in the <strong>Uploads</strong> panel inside the editor, ready to drop into any design.
          </p>
          <button type="button" onClick={onUse}
            className="mt-3 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
            Use in a design <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
