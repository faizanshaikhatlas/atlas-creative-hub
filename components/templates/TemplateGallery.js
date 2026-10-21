"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft, SearchX, ChevronRight, Star } from "lucide-react";
import {
  THEMES, FORMATS, TEMPLATES, filterTemplates, getFeatured, templatesByTheme,
} from "@/lib/template-catalog";
import TemplateCard from "@/components/templates/TemplateCard";
import TemplatePreviewModal from "@/components/templates/TemplatePreviewModal";

const GRID = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4";

export default function TemplateGallery() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState("all");
  const [format, setFormat] = useState("all");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  // Deep-link support: /templates?q=…&theme=…&format=… (from the home dashboard).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const q = p.get("q"); const th = p.get("theme"); const fmt = p.get("format");
    if (q) setQuery(q);
    if (th && THEMES.some((t) => t.id === th)) setTheme(th);
    if (fmt && FORMATS[fmt]) setFormat(fmt);
  }, []);

  const filtering = query.trim() !== "" || theme !== "all" || format !== "all";
  const results = useMemo(() => filterTemplates({ query, theme, format }), [query, theme, format]);

  function selectTheme(id) {
    setTheme(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto min-h-dvh max-w-[1400px] px-4 pb-16 pt-6 sm:px-6">
      <button onClick={() => router.push("/")} className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600">
        <ArrowLeft size={16} /> Back to projects
      </button>

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Template Gallery</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
          {TEMPLATES.length} ready-made, fully editable designs across {THEMES.length} themes. Pick one to open an independent copy in the editor — no sign-in needed.
        </p>
      </header>

      {/* Sticky controls */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates — try “sale”, “launch”, “menu”, “admissions”…"
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
              <option key={id} value={id}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Horizontal scrollable theme nav */}
        <div className="ds-scroll flex gap-2 overflow-x-auto pb-0.5">
          <Chip active={theme === "all"} onClick={() => selectTheme("all")}>All</Chip>
          {THEMES.map((t) => (
            <Chip key={t.id} active={theme === t.id} onClick={() => selectTheme(t.id)} dot={t.swatch[1]}>{t.name}</Chip>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}

      {filtering ? (
        <ResultsView results={results} onPreview={setPreview} onError={setError}
          onClear={() => { setQuery(""); setTheme("all"); setFormat("all"); }} />
      ) : (
        <DefaultView onPreview={setPreview} onError={setError} onViewAll={selectTheme} />
      )}

      {preview && <TemplatePreviewModal template={preview} onClose={() => setPreview(null)} onError={setError} />}
    </div>
  );
}

function DefaultView({ onPreview, onError, onViewAll }) {
  const featured = getFeatured();
  return (
    <div className="space-y-12">
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Star size={18} className="text-amber-500" fill="currentColor" />
          <h2 className="text-lg font-semibold text-slate-900">Featured Templates</h2>
        </div>
        <div className={GRID}>
          {featured.map((t) => <TemplateCard key={t.id} template={t} onPreview={onPreview} onError={onError} />)}
        </div>
      </section>

      {THEMES.map((th) => {
        const items = templatesByTheme(th.id, 4);
        return (
          <section key={th.id}>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ background: th.swatch[1] }} />
                  {th.name}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">{th.tagline}</p>
              </div>
              <button onClick={() => onViewAll(th.id)} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
                View all <ChevronRight size={15} />
              </button>
            </div>
            <div className={GRID}>
              {items.map((t) => <TemplateCard key={t.id} template={t} onPreview={onPreview} onError={onError} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ResultsView({ results, onPreview, onError, onClear }) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 py-24 text-slate-400">
        <SearchX size={34} />
        <p className="text-sm font-medium">No templates match your filters</p>
        <button onClick={onClear} className="text-xs font-medium text-brand-600 hover:underline">Clear filters</button>
      </div>
    );
  }
  return (
    <>
      <p className="mb-4 text-xs text-slate-400">{results.length} template{results.length === 1 ? "" : "s"}</p>
      <div className={GRID}>
        {results.map((t) => <TemplateCard key={t.id} template={t} onPreview={onPreview} onError={onError} />)}
      </div>
    </>
  );
}

function Chip({ active, onClick, children, dot }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition " +
        (active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")
      }
    >
      {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
      {children}
    </button>
  );
}

