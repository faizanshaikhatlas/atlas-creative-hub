"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft, X, Loader2, Sparkles, SearchX } from "lucide-react";
import { THEMES, FORMATS, TEMPLATES, filterTemplates, renderTemplateThumbnail, createDesignFromTemplate } from "@/lib/template-catalog";
import TemplateCard from "@/components/templates/TemplateCard";

export default function TemplateGallery() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState("all");
  const [format, setFormat] = useState("all");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  const results = useMemo(() => filterTemplates({ query, theme, format }), [query, theme, format]);

  return (
    <div className="mx-auto min-h-dvh max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <button onClick={() => router.push("/")} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600">
          <ArrowLeft size={16} /> Back to projects
        </button>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Template gallery</h1>
        <p className="mt-1 text-sm text-slate-500">
          {TEMPLATES.length} ready-made designs across {THEMES.length} themes. Pick one and start editing — your copy is independent.
        </p>
      </header>

      {/* Search + format */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates (e.g. sale, launch, menu)…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-400"
          />
        </div>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-brand-400"
        >
          <option value="all">All formats</option>
          {Object.entries(FORMATS).map(([id, f]) => (
            <option key={id} value={id}>{f.label} · {f.width}×{f.height}</option>
          ))}
        </select>
      </div>

      {/* Theme chips */}
      <div className="ds-scroll mb-6 flex gap-2 overflow-x-auto pb-1">
        <Chip active={theme === "all"} onClick={() => setTheme("all")}>All themes</Chip>
        {THEMES.map((t) => (
          <Chip key={t.id} active={theme === t.id} onClick={() => setTheme(t.id)} dot={t.swatch[1]}>
            {t.name}
          </Chip>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      )}

      <p className="mb-3 text-xs text-slate-400">{results.length} template{results.length === 1 ? "" : "s"}</p>

      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 py-20 text-slate-400">
          <SearchX size={32} />
          <p className="text-sm font-medium">No templates match your filters</p>
          <button
            onClick={() => { setQuery(""); setTheme("all"); setFormat("all"); }}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((t) => (
            <TemplateCard key={t.id} template={t} onPreview={setPreview} onError={setError} />
          ))}
        </div>
      )}

      {preview && (
        <PreviewModal template={preview} onClose={() => setPreview(null)} onError={setError} />
      )}
    </div>
  );
}

function Chip({ active, onClick, children, dot }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition " +
        (active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")
      }
    >
      {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
      {children}
    </button>
  );
}

function PreviewModal({ template, onClose, onError }) {
  const router = useRouter();
  const [src, setSrc] = useState(null);
  const [creating, setCreating] = useState(false);
  const fmt = FORMATS[template.format];

  useEffect(() => {
    let cancelled = false;
    renderTemplateThumbnail(template, 1000).then((u) => !cancelled && setSrc(u)).catch(() => {});
    return () => { cancelled = true; };
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
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">{template.title}</p>
            <p className="text-xs text-slate-400">{fmt.label} · {fmt.width}×{fmt.height}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-50 p-4">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={template.title} className="max-h-[60dvh] w-auto max-w-full rounded-lg shadow" />
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
