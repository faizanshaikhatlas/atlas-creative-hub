"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft, SearchX, ChevronRight, Star, Share2, Briefcase, GraduationCap, Clapperboard, PartyPopper } from "lucide-react";
import {
  THEMES, FORMATS, TEMPLATES, FEATURED_IDS, filterTemplates, getFeatured, templatesByTheme,
} from "@/lib/template-catalog";
import TemplateCard from "@/components/templates/TemplateCard";
import TemplatePreviewModal from "@/components/templates/TemplatePreviewModal";
import { getRecentTemplateIds, recordTemplateView, clearRecentTemplates } from "@/lib/template-catalog/recentlyViewed";

const GRID = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4";

// Curated quick-category shortcuts (Canva-style). Each applies a real filter
// preset over the EXISTING catalog — never a dead control. A theme preset lights
// up its theme chip; the "Events" preset runs a real keyword search ("event"
// matches 6 catalog templates), so the search box reflects it.
const QUICK_CATEGORIES = [
  { label: "Social media", Icon: Share2, theme: "social" },
  { label: "Business", Icon: Briefcase, theme: "corporate" },
  { label: "Education", Icon: GraduationCap, theme: "education" },
  { label: "YouTube", Icon: Clapperboard, theme: "youtube" },
  { label: "Events", Icon: PartyPopper, query: "event" },
];

export default function TemplateGallery() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState("all");
  const [format, setFormat] = useState("all");
  const [preview, setPreview] = useState(null);
  const [sortBy, setSortBy] = useState("featured"); // featured | name | format
  const [recentIds, setRecentIds] = useState([]); // device-local; hydrated on mount
  const [error, setError] = useState(null);

  // Hydrate device-local recents after mount (localStorage is client-only).
  useEffect(() => { setRecentIds(getRecentTemplateIds()); }, []);

  // Valid catalog entries only, in most-recent-first order (invalid/stale IDs drop).
  const recent = recentIds.map((id) => TEMPLATES.find((t) => t.id === id)).filter(Boolean);

  // Open the preview AND record the view (device-local, no sensitive data).
  function openPreview(t) {
    recordTemplateView(t.id);
    setRecentIds(getRecentTemplateIds());
    setPreview(t);
  }
  function clearRecent() {
    clearRecentTemplates();
    setRecentIds([]);
  }

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

  // Count real templates per format so we only show format tiles that actually
  // have designs (a tile that filtered to nothing would be a dead control).
  const formatCounts = useMemo(() => {
    const m = {};
    for (const t of TEMPLATES) m[t.format] = (m[t.format] || 0) + 1;
    return m;
  }, []);

  function scrollTop() {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function selectTheme(id) {
    setTheme(id);
    scrollTop();
  }
  function toggleFormat(id) {
    setFormat((f) => (f === id ? "all" : id));
    scrollTop();
  }
  // Apply a quick-category preset: set exactly its fields, reset the others.
  function applyQuick(c) {
    setQuery(c.query || "");
    setTheme(c.theme || "all");
    setFormat(c.format || "all");
    scrollTop();
  }
  function quickActive(c) {
    return query.trim().toLowerCase() === (c.query || "").toLowerCase()
      && theme === (c.theme || "all")
      && format === (c.format || "all");
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

      {/* Sticky controls: search + full theme filter (always reachable) */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search templates"
            placeholder="Search templates — try “sale”, “launch”, “menu”, “admissions”…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-400"
          />
        </div>

        {/* Horizontal scrollable theme nav */}
        <div className="ds-scroll flex gap-2 overflow-x-auto pb-0.5">
          <Chip active={theme === "all"} onClick={() => selectTheme("all")}>All</Chip>
          {THEMES.map((t) => (
            <Chip key={t.id} active={theme === t.id} onClick={() => selectTheme(t.id)} dot={t.swatch[1]}>{t.name}</Chip>
          ))}
        </div>
      </div>

      {/* Quick categories + Explore by format — one-tap browsing over the real
          catalog (the format tiles replace the old format dropdown). */}
      <section className="mb-8">
        <div className="ds-scroll mb-4 flex gap-2 overflow-x-auto pb-0.5">
          {QUICK_CATEGORIES.map((c) => (
            <QuickChip key={c.label} active={quickActive(c)} Icon={c.Icon} onClick={() => applyQuick(c)}>{c.label}</QuickChip>
          ))}
        </div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Explore by format</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          {Object.entries(FORMATS)
            .filter(([id]) => (formatCounts[id] || 0) > 0)
            .map(([id, f]) => (
              <FormatTile key={id} fmt={f} count={formatCounts[id]} active={format === id} onClick={() => toggleFormat(id)} />
            ))}
        </div>
      </section>

      {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}

      {filtering ? (
        <ResultsView results={results} sortBy={sortBy} onSort={setSortBy} onPreview={openPreview} onError={setError}
          onClear={() => { setQuery(""); setTheme("all"); setFormat("all"); }} />
      ) : (
        <DefaultView recent={recent} onClearRecent={clearRecent} onPreview={openPreview} onError={setError} onViewAll={selectTheme} />
      )}

      {preview && <TemplatePreviewModal template={preview} onClose={() => setPreview(null)} onError={setError} />}
    </div>
  );
}

function DefaultView({ recent, onClearRecent, onPreview, onError, onViewAll }) {
  const featured = getFeatured();
  return (
    <div className="space-y-12">
      {recent.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Recently viewed</h2>
              <p className="mt-0.5 text-xs text-slate-400">On this device · not synced to your account</p>
            </div>
            <button onClick={onClearRecent} aria-label="Clear recently viewed templates" className="shrink-0 text-xs font-medium text-slate-400 hover:text-brand-600 hover:underline">Clear</button>
          </div>
          <div className={GRID}>
            {recent.map((t) => <TemplateCard key={t.id} template={t} onPreview={onPreview} onError={onError} />)}
          </div>
        </section>
      )}

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

// Sort a COPY of the filtered results (never mutates the catalog or shared data).
// Array.sort is stable, so ties keep the catalog's hand-ordered sequence.
function sortResults(list, sortBy) {
  const copy = [...list];
  if (sortBy === "name") {
    copy.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  } else if (sortBy === "format") {
    copy.sort((a, b) => {
      const la = FORMATS[a.format]?.label || a.format;
      const lb = FORMATS[b.format]?.label || b.format;
      return la.localeCompare(lb) || (a.title || "").localeCompare(b.title || "");
    });
  } else {
    // featured: curated picks first (in FEATURED_IDS order), then catalog order.
    const rank = new Map(FEATURED_IDS.map((id, i) => [id, i]));
    copy.sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
      const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
      return ra - rb;
    });
  }
  return copy;
}

function ResultsView({ results, sortBy, onSort, onPreview, onError, onClear }) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 py-24 text-slate-400">
        <SearchX size={34} />
        <p className="text-sm font-medium">No templates match your filters</p>
        <button onClick={onClear} className="text-xs font-medium text-brand-600 hover:underline">Clear filters</button>
      </div>
    );
  }
  const sorted = sortResults(results, sortBy);
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">{results.length} template{results.length === 1 ? "" : "s"}</p>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <span className="hidden sm:inline">Sort</span>
          <select value={sortBy} onChange={(e) => onSort(e.target.value)} aria-label="Sort templates"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 outline-none focus:border-brand-400">
            <option value="featured">Featured</option>
            <option value="name">Name (A–Z)</option>
            <option value="format">Format</option>
          </select>
        </label>
      </div>
      <div className={GRID}>
        {sorted.map((t) => <TemplateCard key={t.id} template={t} onPreview={onPreview} onError={onError} />)}
      </div>
    </>
  );
}

function QuickChip({ active, onClick, Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition " +
        (active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300")
      }
    >
      {Icon && <Icon size={14} />} {children}
    </button>
  );
}

function FormatTile({ fmt, count, active, onClick }) {
  // A small shape proportional to the real output ratio, so the tile communicates
  // the format's orientation (landscape / square / portrait) at a glance.
  const ratio = fmt.width / fmt.height;
  const box = ratio >= 1
    ? { width: 34, height: Math.max(10, Math.round(34 / ratio)) }
    : { height: 34, width: Math.max(10, Math.round(34 * ratio)) };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${fmt.label} · ${fmt.width}×${fmt.height} · ${count} template${count === 1 ? "" : "s"}`}
      className={
        "flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition " +
        (active ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm")
      }
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
        <span className="rounded-sm bg-gradient-to-br from-brand-200 to-brand-400" style={{ width: box.width, height: box.height }} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-slate-700">{fmt.short || fmt.label}</span>
        <span className="block text-[10px] text-slate-400">{fmt.width} × {fmt.height}</span>
      </span>
    </button>
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

