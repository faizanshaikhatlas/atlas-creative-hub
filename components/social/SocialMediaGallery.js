"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft, SearchX, ChevronRight, TrendingUp, Camera, Users, PlayCircle } from "lucide-react";
import { Loader2 } from "lucide-react";
import { FORMATS, TEMPLATES, FEATURED_IDS } from "@/lib/template-catalog";
import { SIZE_PRESETS } from "@/lib/db/projects";
import { apiCreateProject } from "@/lib/designs/client";
import { useAuth } from "@/components/auth/AuthProvider";
import TemplateCard from "@/components/templates/TemplateCard";
import TemplatePreviewModal from "@/components/templates/TemplatePreviewModal";

function newUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const GRID = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4";

/**
 * Social platforms backed by REAL catalog formats. `formats: null` = Popular
 * (all social formats). To add a platform later (WhatsApp, LinkedIn, X/Twitter),
 * first add a real format with original templates to the catalog, then add a row
 * here — a platform whose formats have 0 templates is hidden automatically, so no
 * filter ever returns fake or empty content. Icons are generic (this lucide build
 * ships no brand marks); swap when brand icons are available.
 */
const PLATFORMS = [
  { id: "popular", label: "Popular", Icon: TrendingUp, formats: null },
  { id: "instagram", label: "Instagram", Icon: Camera, formats: ["ig-post", "ig-story"] },
  { id: "facebook", label: "Facebook", Icon: Users, formats: ["fb-post"] },
  { id: "youtube", label: "YouTube", Icon: PlayCircle, formats: ["yt-thumbnail", "yt-banner"] },
];

// The social catalog scope = the union of every platform's formats.
export const SOCIAL_FORMATS = [...new Set(PLATFORMS.flatMap((p) => p.formats || []))];

// Grouped sections for the landing (Popular view). Each maps to ONE real format
// so names + dimensions are accurate; a section with 0 templates is skipped.
const SECTIONS = [
  { format: "ig-post", title: "Instagram Posts" },
  { format: "ig-story", title: "Instagram Stories" },
  { format: "fb-post", title: "Facebook Posts" },
  { format: "yt-thumbnail", title: "YouTube Thumbnails" },
];
// Which platform chip a "See all" jumps to for a given format.
const FORMAT_PLATFORM = { "ig-post": "instagram", "ig-story": "instagram", "fb-post": "facebook", "yt-thumbnail": "youtube", "yt-banner": "youtube" };
const SECTION_CAP = 8; // cards per section before "See all" (mirrors the themes gallery)

// Secondary "blank size" options — a curated subset of the EXISTING SIZE_PRESETS
// (no dimensions changed, nothing removed from the global New-design dialog).
const BLANK_PRESET_IDS = ["instagram-post", "instagram-story", "facebook-post", "youtube-thumbnail", "youtube-banner"];
const BLANK_PRESETS = BLANK_PRESET_IDS.map((id) => SIZE_PRESETS.find((p) => p.id === id)).filter(Boolean);

export default function SocialMediaGallery() {
  const router = useRouter();
  const { configured, user, active } = useAuth();
  const [platform, setPlatform] = useState("popular");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // Create a BLANK design at a standard size — same auth/approval gating and same
  // authenticated API the homepage uses (not a second creation path). An
  // independent record under the signed-in user; never touches shared data.
  async function createBlank(preset) {
    if (!configured) { setError("Cloud is not configured for this deployment."); return; }
    if (!user) { router.push(`/login?next=${encodeURIComponent("/create/social")}`); return; }
    if (active !== true) {
      setError(active === false
        ? "Your account is awaiting administrator approval before you can create designs."
        : "Still checking your account — please try again in a moment.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const pageId = newUuid();
      const res = await apiCreateProject(
        { name: "Untitled design", type: preset.id, width: preset.width, height: preset.height, activePageId: pageId,
          pages: [{ id: pageId, name: "Page 1", json: null, background: "#ffffff", width: preset.width, height: preset.height }] },
        user.id
      );
      router.push(`/editor/${res.id}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
      setError(e.status === 403 ? "Your account is awaiting approval." : "Could not create a new design.");
    }
  }

  // Social-format templates only (no catalog mutation — just a filtered view).
  const social = useMemo(() => TEMPLATES.filter((t) => SOCIAL_FORMATS.includes(t.format)), []);
  const formatCounts = useMemo(() => {
    const m = {};
    for (const t of social) m[t.format] = (m[t.format] || 0) + 1;
    return m;
  }, [social]);

  // Only show platforms that actually have compatible templates.
  const platforms = useMemo(
    () => PLATFORMS.filter((p) => (p.formats === null ? social.length > 0 : p.formats.some((f) => (formatCounts[f] || 0) > 0))),
    [social, formatCounts]
  );

  const activeFormats = useMemo(() => {
    const p = PLATFORMS.find((x) => x.id === platform);
    return p && p.formats ? p.formats : SOCIAL_FORMATS;
  }, [platform]);

  // Social catalog, featured-first (used by both the grouped landing and the
  // flat results). Sorting a COPY — never mutates the shared catalog.
  const ranked = useMemo(() => {
    const rank = new Map(FEATURED_IDS.map((id, i) => [id, i]));
    return [...social].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
      const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
      return ra - rb;
    });
  }, [social]);

  // Featured-first results for the flat view (platform + search filtered).
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ranked.filter((t) => activeFormats.includes(t.format)).filter((t) => {
      if (!q) return true;
      const hay = `${t.title} ${t.theme} ${(t.keywords || []).join(" ")} ${FORMATS[t.format]?.label || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [ranked, activeFormats, query]);

  // The grouped landing shows only on the default Popular view with no search.
  const showLanding = platform === "popular" && query.trim() === "";
  const popular = ranked.slice(0, SECTION_CAP);

  function selectPlatform(id) {
    setPlatform(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto min-h-dvh max-w-[1400px] px-4 pb-16 pt-6 sm:px-6">
      <button onClick={() => router.push("/")} className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600">
        <ArrowLeft size={16} /> Back to projects
      </button>

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Create a social media design</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
          Ready-made, fully editable posts, stories and thumbnails for Instagram, Facebook and YouTube. Pick one to open an independent copy in the editor.
        </p>
      </header>

      {/* Sticky controls: search + platform chips */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search social media templates"
            placeholder="Search social templates — “sale”, “launch”, “event”, “quote”…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-400"
          />
        </div>
        <div className="ds-scroll flex gap-2 overflow-x-auto pb-0.5">
          {platforms.map((p) => (
            <PlatformChip key={p.id} active={platform === p.id} Icon={p.Icon} onClick={() => selectPlatform(p.id)}>{p.label}</PlatformChip>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}

      {showLanding ? (
        <div className="space-y-12">
          <section>
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-brand-500" />
              <h2 className="text-lg font-semibold text-slate-900">Popular</h2>
            </div>
            <div className={GRID}>
              {popular.map((t) => <TemplateCard key={t.id} template={t} onPreview={setPreview} onError={setError} />)}
            </div>
          </section>

          {SECTIONS.map(({ format, title }) => {
            const all = ranked.filter((t) => t.format === format);
            if (all.length === 0) return null; // never render an empty section
            const items = all.slice(0, SECTION_CAP);
            const fmt = FORMATS[format];
            return (
              <section key={format}>
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                    {fmt && <p className="mt-0.5 text-xs text-slate-400">{fmt.width} × {fmt.height}</p>}
                  </div>
                  {all.length > SECTION_CAP && (
                    <button onClick={() => selectPlatform(FORMAT_PLATFORM[format] || "popular")}
                      className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
                      See all {all.length} <ChevronRight size={15} />
                    </button>
                  )}
                </div>
                <div className={GRID}>
                  {items.map((t) => <TemplateCard key={t.id} template={t} onPreview={setPreview} onError={setError} />)}
                </div>
              </section>
            );
          })}
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 py-24 text-slate-400">
          <SearchX size={34} />
          <p className="text-sm font-medium">No social templates match your search</p>
          <button onClick={() => { setQuery(""); setPlatform("popular"); }} className="text-xs font-medium text-brand-600 hover:underline">Reset</button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-xs text-slate-400">{results.length} template{results.length === 1 ? "" : "s"}</p>
          <div className={GRID}>
            {results.map((t) => <TemplateCard key={t.id} template={t} onPreview={setPreview} onError={setError} />)}
          </div>
        </>
      )}

      {/* Secondary: start from a blank size (existing size-selection, kept available) */}
      <section className="mt-14 border-t border-slate-100 pt-8">
        <h2 className="text-lg font-semibold text-slate-900">Or start from a blank size</h2>
        <p className="mt-0.5 mb-4 text-xs text-slate-400">Create an empty canvas at a standard social size. {creating && <span className="inline-flex items-center gap-1 text-brand-600"><Loader2 size={12} className="animate-spin" /> creating…</span>}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {BLANK_PRESETS.map((p) => (
            <BlankSizeTile key={p.id} preset={p} disabled={creating} onClick={() => createBlank(p)} />
          ))}
        </div>
      </section>

      {preview && <TemplatePreviewModal template={preview} onClose={() => setPreview(null)} onError={setError} />}
    </div>
  );
}

function BlankSizeTile({ preset, disabled, onClick }) {
  const ratio = preset.width / preset.height;
  const box = ratio >= 1
    ? { width: 34, height: Math.max(10, Math.round(34 / ratio)) }
    : { height: 34, width: Math.max(10, Math.round(34 * ratio)) };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`Blank ${preset.label} · ${preset.width}×${preset.height}`}
      className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 text-left transition hover:border-brand-300 hover:shadow-sm disabled:opacity-60"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
        <span className="rounded-sm bg-brand-100 ring-1 ring-brand-300" style={{ width: box.width, height: box.height }} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-slate-700">{preset.label}</span>
        <span className="block text-[10px] text-slate-400">{preset.width} × {preset.height}</span>
      </span>
    </button>
  );
}

function PlatformChip({ active, onClick, Icon, children }) {
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
