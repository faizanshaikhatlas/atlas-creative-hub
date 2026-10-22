"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft, SearchX, Info, Loader2 } from "lucide-react";
import { VIDEO_FORMATS, VIDEO_CATEGORIES } from "@/lib/video/formats";
import { VIDEO_TEMPLATES, FEATURED_VIDEO_IDS } from "@/lib/video/catalog";
import { createVideoFromStarter, createBlankVideo } from "@/lib/video/create";
import { useAuth } from "@/components/auth/AuthProvider";
import VideoTemplateCard from "@/components/video/VideoTemplateCard";
import VideoPreviewModal from "@/components/video/VideoPreviewModal";

const GRID = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4";

export default function VideoGallery() {
  const router = useRouter();
  const { configured, user, active } = useAuth();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("popular");
  const [format, setFormat] = useState("all");
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState(null);
  const [creating, setCreating] = useState(false);

  // Guard shared by Use-template and blank-video: real auth/approval gating,
  // identical to the rest of the app. Returns true when creation may proceed.
  function ensureCanCreate(returnTo = "/create/video") {
    if (!configured) { setNotice("Cloud is not configured for this deployment."); return false; }
    if (!user) { router.push(`/login?next=${encodeURIComponent(returnTo)}`); return false; }
    if (active !== true) {
      setNotice(active === false
        ? "Your account is awaiting administrator approval before you can create videos."
        : "Still checking your account — please try again in a moment.");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      return false;
    }
    return true;
  }

  async function useStarter(starter) {
    if (creating || !ensureCanCreate()) return;
    setCreating(true); setNotice(null);
    try {
      const res = await createVideoFromStarter(starter, user.id);
      router.push(`/editor/${res.id}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
      setNotice(e?.status === 403 ? "Your account is awaiting approval." : "Could not create the video project. Please try again.");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function startBlank(formatId) {
    if (creating || !ensureCanCreate()) return;
    setCreating(true); setNotice(null);
    try {
      const res = await createBlankVideo(formatId, user.id);
      router.push(`/editor/${res.id}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
      setNotice(e?.status === 403 ? "Your account is awaiting approval." : "Could not create the video project. Please try again.");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Only show category chips that actually have starters (Popular always shown).
  const categories = useMemo(
    () => VIDEO_CATEGORIES.filter((c) => c.id === "popular" || VIDEO_TEMPLATES.some((t) => t.categories.includes(c.id))),
    []
  );
  const formatCounts = useMemo(() => {
    const m = {};
    for (const t of VIDEO_TEMPLATES) m[t.format] = (m[t.format] || 0) + 1;
    return m;
  }, []);

  // Featured-first ordering (sorting a copy — catalog is never mutated).
  const ranked = useMemo(() => {
    const rank = new Map(FEATURED_VIDEO_IDS.map((id, i) => [id, i]));
    return [...VIDEO_TEMPLATES].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
      const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
      return ra - rb;
    });
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ranked
      .filter((t) => category === "popular" || t.categories.includes(category))
      .filter((t) => format === "all" || t.format === format)
      .filter((t) => {
        if (!q) return true;
        const hay = `${t.title} ${t.categories.join(" ")} ${t.keywords.join(" ")} ${VIDEO_FORMATS[t.format]?.label || ""}`.toLowerCase();
        return hay.includes(q);
      });
  }, [ranked, category, format, query]);

  return (
    <div className="mx-auto min-h-dvh max-w-[1400px] px-4 pb-16 pt-6 sm:px-6">
      <button onClick={() => router.push("/")} className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600">
        <ArrowLeft size={16} /> Back to projects
      </button>

      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Create a video</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
          {VIDEO_TEMPLATES.length} original, editable video starters for YouTube, Reels, TikTok and more. Pick one to open an independent copy in the video editor.
        </p>
      </header>

      <div className="mb-6 flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span><strong>Use template</strong> and <strong>blank video</strong> create a real, saved video project you can reopen. Full timeline editing (playback, clips, text, audio) is rolling out next — the editor clearly marks what isn’t ready yet.</span>
      </div>

      {notice && <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{notice}</div>}

      {creating && (
        <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
          <Loader2 size={15} className="animate-spin" /> Creating your video project…
        </div>
      )}

      {/* Sticky: search + category chips */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search video templates"
            placeholder="Search video templates — “intro”, “promo”, “sale”, “lesson”…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-400"
          />
        </div>
        <div className="ds-scroll flex gap-2 overflow-x-auto pb-0.5">
          {categories.map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => { setCategory(c.id); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }}>{c.label}</Chip>
          ))}
        </div>
      </div>

      {/* Video formats (also a filter) */}
      <section className="mb-8">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Video formats</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {Object.entries(VIDEO_FORMATS)
            .filter(([id]) => (formatCounts[id] || 0) > 0)
            .map(([id, f]) => (
              <FormatTile key={id} fmt={f} active={format === id} onClick={() => setFormat((fm) => (fm === id ? "all" : id))} />
            ))}
        </div>
      </section>

      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 py-24 text-slate-400">
          <SearchX size={34} />
          <p className="text-sm font-medium">No video templates match your search</p>
          <button onClick={() => { setQuery(""); setCategory("popular"); setFormat("all"); }} className="text-xs font-medium text-brand-600 hover:underline">Reset</button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-xs text-slate-400">{results.length} template{results.length === 1 ? "" : "s"}</p>
          <div className={GRID}>
            {results.map((t) => (
              <VideoTemplateCard key={t.id} template={t} onPreview={setPreview} onUse={useStarter} />
            ))}
          </div>
        </>
      )}

      {/* Secondary: blank video — real, authenticated creation */}
      <section className="mt-14 border-t border-slate-100 pt-8">
        <h2 className="text-lg font-semibold text-slate-900">Or start a blank video</h2>
        <p className="mt-0.5 mb-4 text-xs text-slate-400">Pick a size to start an empty video project in the editor.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(VIDEO_FORMATS).map(([id, f]) => (
            <BlankTile key={id} fmt={f} disabled={creating} onClick={() => startBlank(id)} />
          ))}
        </div>
      </section>

      {preview && (
        <VideoPreviewModal template={preview} onClose={() => setPreview(null)} onUse={(tpl) => { setPreview(null); useStarter(tpl); }} />
      )}
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition " +
        (active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300")
      }
    >
      {children}
    </button>
  );
}

function aspectBox(fmt) {
  const ratio = fmt.width / fmt.height;
  return ratio >= 1
    ? { width: 34, height: Math.max(10, Math.round(34 / ratio)) }
    : { height: 34, width: Math.max(10, Math.round(34 * ratio)) };
}

function FormatTile({ fmt, active, onClick }) {
  const box = aspectBox(fmt);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${fmt.label} · ${fmt.width}×${fmt.height} · ${fmt.aspect}`}
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

function BlankTile({ fmt, disabled, onClick }) {
  const box = aspectBox(fmt);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`Blank ${fmt.label} · ${fmt.width}×${fmt.height}`}
      className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 text-left transition hover:border-brand-300 hover:shadow-sm disabled:opacity-60"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
        <span className="rounded-sm bg-brand-100 ring-1 ring-brand-300" style={{ width: box.width, height: box.height }} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-slate-700">{fmt.short || fmt.label}</span>
        <span className="block text-[10px] text-slate-400">{fmt.width} × {fmt.height}</span>
      </span>
    </button>
  );
}
