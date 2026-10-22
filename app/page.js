"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Search, Sparkles, ArrowRight, MoreVertical, Pencil, Copy, LogIn, LayoutTemplate, Presentation, Share2, Video, FileText, Table, PenTool, Scaling, Upload, MoreHorizontal, AlertTriangle, RefreshCw, Printer } from "lucide-react";
import { SIZE_PRESETS } from "@/lib/db/projects";
import { apiListProjects, apiCreateProject, apiDeleteProject, apiGetProject, apiUpdateProject } from "@/lib/designs/client";
import { THEMES } from "@/lib/template-catalog/formats";
import { getFeatured, FORMATS } from "@/lib/template-catalog";
import NewDesignDialog from "@/components/NewDesignDialog";
import AccountMenu from "@/components/auth/AccountMenu";
import DesignThumb from "@/components/designs/DesignThumb";
import HomeBrandUploads from "@/components/dashboard/HomeBrandUploads";
import TemplateCard from "@/components/templates/TemplateCard";
import TemplatePreviewModal from "@/components/templates/TemplatePreviewModal";
import { useAuth } from "@/components/auth/AuthProvider";

// Representative photo per theme for the browse tiles (already in /public).
const THEME_PHOTO = {
  luxury: "/template-photos/lux-watch.jpg",
  minimal: "/template-photos/min-art.jpg",
  youtube: "/template-photos/yt-portrait.jpg",
  corporate: "/template-photos/corp-audience.jpg",
  education: "/template-photos/edu-students.jpg",
  nature: "/template-photos/nat-botanical.jpg",
  food: "/template-photos/food-dish.jpg",
  tech: "/template-photos/tech-device.jpg",
};

// Home create-design shortcuts. Each leads to a REAL destination (create a
// design, open the New design dialog, or go to templates) or honestly explains
// an unavailable capability — never a fake button. The editor is a static
// multi-page canvas, so Video/Doc/Whiteboard/Sheet are marked "soon".
const CREATE_SHORTCUTS = [
  { key: "templates", label: "Templates", Icon: LayoutTemplate, kind: "nav", href: "/templates" },
  { key: "presentation", label: "Presentation", Icon: Presentation, kind: "create", type: "presentation" },
  { key: "social", label: "Social media", Icon: Share2, kind: "nav", href: "/create/social" },
  { key: "video", label: "Video", Icon: Video, kind: "nav", href: "/create/video" },
  { key: "doc", label: "Doc", Icon: FileText, kind: "unavailable", note: "Documents aren’t available yet in ATLAS." },
  { key: "whiteboard", label: "Whiteboard", Icon: PenTool, kind: "unavailable", note: "Whiteboards aren’t available yet in ATLAS." },
  { key: "sheet", label: "Sheet", Icon: Table, kind: "unavailable", note: "Sheets aren’t available yet in ATLAS." },
  { key: "custom", label: "Custom size", Icon: Scaling, kind: "dialog" },
  { key: "upload", label: "Upload", Icon: Upload, kind: "info", note: "Uploads are added inside a design: create or open a design, then use the Uploads panel to add your own images." },
  { key: "more", label: "More", Icon: MoreHorizontal, kind: "dialog" },
];

function newUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function formatDate(ts) {
  if (!ts) return "";
  try { return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return ""; }
}

// Human format label from the design's stored type (custom sizes → "Custom").
function formatLabelFor(type) {
  if (type === "video") return "Video";
  const preset = SIZE_PRESETS.find((s) => s.id === type);
  return preset ? preset.label : "Custom";
}

// How many designs to show before "Show all" (client-side; all are already loaded).
const RECENT_CAP = 12;

export default function HomePage() {
  const router = useRouter();
  const { configured, loading: authLoading, user, active } = useAuth();
  const [projects, setProjects] = useState(null); // null = loading
  const [listState, setListState] = useState("loading"); // loading|ok|signedout|pending|error
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState("");
  const [designQuery, setDesignQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [designFormat, setDesignFormat] = useState("all"); // private format filter
  const [showAll, setShowAll] = useState(false); // expand beyond the recent cap
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null); // transient success/info
  const [shortcutMsg, setShortcutMsg] = useState(null); // { tone:"info"|"warn", text }
  const [preview, setPreview] = useState(null); // template being previewed

  const userId = user?.id ?? null;

  // Personal designs come ONLY from the authenticated user's cloud account.
  async function load() {
    setError(null);
    if (!configured) { setProjects([]); setListState("ok"); return; }
    if (!userId) { setProjects([]); setListState("signedout"); return; }
    // active is tri-state: null = UNKNOWN (approval not yet resolved, or /api/me
    // failed) → show a neutral loading state, NEVER the pending banner. Only a
    // CONFIRMED false shows "awaiting approval".
    if (active === null) { setListState("loading"); return; }
    if (active === false) { setProjects([]); setListState("pending"); return; }
    setListState("loading");
    try {
      const rows = await apiListProjects();
      setProjects(rows.map((r) => ({
        id: r.id, name: r.name, type: r.type, width: r.width, height: r.height,
        updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : 0,
      })));
      setListState("ok");
    } catch (e) {
      if (e.status === 401) { setProjects([]); setListState("signedout"); }
      else if (e.status === 403) { setProjects([]); setListState("pending"); }
      else { setProjects([]); setListState("error"); setError("Could not load your designs. Check your connection and try again."); }
    }
  }

  // Load whenever auth settles or the account/approval changes.
  useEffect(() => {
    if (authLoading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, configured, userId, active]);

  function requireAuthThen(returnTo = "/") {
    router.push(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  // Open the New design dialog (all formats + custom size), auth-gated.
  function openCreateDialog() {
    if (!configured) { setError("Cloud is not configured for this deployment."); return; }
    if (!userId) { requireAuthThen("/"); return; }
    if (active !== true) {
      setError(active === false
        ? "Your account is awaiting administrator approval before you can create designs."
        : "Still checking your account — please try again in a moment.");
      return;
    }
    setShortcutMsg(null);
    setShowNew(true);
  }

  // Dispatch a home create-design shortcut to its real destination, or explain
  // an unavailable capability (never a no-op button).
  function runShortcut(s) {
    setShortcutMsg(null);
    if (s.kind === "nav") { router.push(s.href); return; }
    if (s.kind === "create") { quickCreate({ type: s.type }); return; }
    if (s.kind === "dialog") { openCreateDialog(); return; }
    setShortcutMsg({ tone: s.kind === "unavailable" ? "warn" : "info", text: s.note });
  }

  async function quickCreate({ type, width, height } = {}) {
    if (!configured) { setError("Cloud is not configured for this deployment."); return; }
    if (!userId) { setShowNew(false); requireAuthThen("/"); return; }
    if (active !== true) {
      setShowNew(false);
      setError(active === false
        ? "Your account is awaiting administrator approval before you can create designs."
        : "Still checking your account — please try again in a moment.");
      return;
    }
    setShowNew(false);
    setCreating(true);
    setError(null);
    try {
      const preset = SIZE_PRESETS.find((s) => s.id === type) || SIZE_PRESETS[0];
      const w = width || preset.width;
      const h = height || preset.height;
      const page = { id: newUuid(), name: "Page 1", json: null, background: "#ffffff", width: w, height: h };
      const res = await apiCreateProject(
        { name: "Untitled design", type: type || "custom", width: w, height: h, activePageId: page.id, pages: [page] },
        userId
      );
      router.push(`/editor/${res.id}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
      setError(e.status === 403 ? "Your account is awaiting approval." : "Could not create a new design.");
    }
  }

  async function handleDelete(p) {
    if (!window.confirm(`Delete “${p.name || "this design"}”? This permanently removes it from your account and cannot be undone.`)) return;
    setError(null);
    try {
      await apiDeleteProject(p.id);
      setNotice(`“${p.name || "Design"}” was permanently deleted.`);
      await load();
    } catch (e) {
      console.error(e);
      setError("Could not delete the design.");
    }
  }

  async function handleDuplicate(p) {
    setError(null);
    try {
      const full = await apiGetProject(p.id, userId);
      const pages = full.pages.map((pg, i) => ({ ...pg, id: newUuid(), name: pg.name || `Page ${i + 1}` }));
      await apiCreateProject(
        { name: `${full.name || "Untitled design"} copy`, type: full.type, width: full.width, height: full.height, activePageId: pages[0]?.id, pages },
        userId
      );
      await load();
    } catch (e) { console.error(e); setError("Could not duplicate the design."); }
  }

  async function handleRename(p, name) {
    const trimmed = (name || "").trim();
    if (!trimmed || trimmed === p.name) return;
    setError(null);
    try {
      const full = await apiGetProject(p.id, userId);
      await apiUpdateProject(p.id,
        { name: trimmed, type: full.type, width: full.width, height: full.height, activePageId: full.activePageId, pages: full.pages },
        { userId, expectedUpdatedAt: full.updatedAt });
      await load();
    } catch (e) { console.error(e); setError(e.code === "conflict" ? "This design changed on another device — reopen it and try again." : "Could not rename the design."); }
  }

  function submitSearch(e) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/templates?q=${encodeURIComponent(q)}` : "/templates");
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/atlas-logo.svg" alt="ATLAS Creative Hub" width={200} height={39} className="h-8 w-auto sm:h-9" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => router.push("/templates")}
              className="hidden rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-brand-700 sm:inline-flex">
              Templates
            </button>
            <AccountMenu />
            <button type="button" onClick={openCreateDialog} disabled={creating} aria-label="Create a design"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60 sm:px-4">
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              <span className="hidden sm:inline">Create a design</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pb-20 sm:px-6">
        {/* Hero + search */}
        <section className="py-10 text-center sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">What will you design today?</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            Start from a template or a blank canvas. Sign in to save your designs to your account and open them on any device.
          </p>
          <form onSubmit={submitSearch} className="mx-auto mt-6 flex max-w-xl items-center">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates — “sale”, “launch”, “menu”, “admissions”…"
                className="w-full rounded-l-xl border border-r-0 border-slate-200 bg-white py-3 pl-11 pr-3 text-sm outline-none focus:border-brand-400"
                aria-label="Search templates" />
            </div>
            <button type="submit" className="rounded-r-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">Search</button>
          </form>
        </section>

        {error && <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {notice && <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
        {listState === "pending" && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your account is awaiting administrator approval. You can browse templates now; creating and saving designs unlocks once you&apos;re approved.
          </div>
        )}

        {/* Create a design — shortcut row */}
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Create a design</h2>
          {shortcutMsg && (
            <div className={
              "mb-4 rounded-lg border px-4 py-3 text-sm " +
              (shortcutMsg.tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700")
            }>
              {shortcutMsg.text}
            </div>
          )}
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
            {CREATE_SHORTCUTS.map((s) => {
              const unavailable = s.kind === "unavailable";
              const Icon = s.Icon;
              return (
                <button key={s.key} type="button" onClick={() => runShortcut(s)} title={s.note || s.label}
                  className={
                    "group relative flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition " +
                    (unavailable
                      ? "border-slate-200 bg-slate-50 opacity-70 hover:opacity-100"
                      : "border-slate-200 bg-white hover:border-brand-400 hover:shadow-sm")
                  }>
                  <span className={
                    "flex h-10 w-10 items-center justify-center rounded-full " +
                    (unavailable ? "bg-slate-200 text-slate-400" : "bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700")
                  }>
                    <Icon size={18} />
                  </span>
                  <span className="text-[11px] font-medium leading-tight text-slate-700">{s.label}</span>
                  {unavailable && (
                    <span className="absolute right-1 top-1 rounded bg-slate-200 px-1 text-[8px] font-semibold uppercase tracking-wide text-slate-500">soon</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Browse by format */}
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Browse by format</h2>
            <button onClick={() => router.push("/templates")} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
              All templates <ArrowRight size={15} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(FORMATS).map(([id, f]) => (
              <button key={id} type="button" onClick={() => router.push(`/templates?format=${id}`)}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-brand-400 hover:shadow-sm">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-700">{f.label}</span>
                  <span className="block text-[11px] text-slate-400">{f.width} × {f.height}</span>
                </span>
                <ArrowRight size={15} className="shrink-0 text-slate-300" />
              </button>
            ))}
          </div>
        </section>

        {/* Browse by theme */}
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Browse by theme</h2>
            <button onClick={() => router.push("/templates")} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
              All templates <ArrowRight size={15} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {THEMES.map((t) => (
              <button key={t.id} type="button" onClick={() => router.push(`/templates?theme=${t.id}`)}
                className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 text-left shadow-sm transition hover:shadow-md"
                style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` }}>
                {THEME_PHOTO[t.id] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={THEME_PHOTO[t.id]} alt="" loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-55 transition group-hover:opacity-70 group-hover:scale-105" />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 p-3">
                  <span className="block text-sm font-semibold leading-tight text-white drop-shadow">{t.name}</span>
                  <span className="mt-0.5 block text-[11px] text-white/80">{t.tagline}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Brand & uploads — discoverability for existing (in-editor) features */}
        {active === true && <HomeBrandUploads onUse={openCreateDialog} />}

        {/* Print & export — honest: ATLAS creates + exports print-ready files, but
            does NOT offer print ordering/delivery (no provider is integrated). */}
        {active === true && (
          <section className="mb-12">
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Print &amp; export</h2>
            <p className="mb-4 text-xs text-slate-400">Create print-ready designs and download them yourself.</p>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700"><Printer size={17} /></span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Make something to print</p>
                    <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
                      Design a poster or a custom print size, then export a <strong>print-ready PDF</strong> (or PNG/JPG) from the editor’s Export menu.
                      Online print ordering and delivery isn’t available in ATLAS — you download the file and print it yourself.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => quickCreate({ type: "custom", width: 1080, height: 1350 })}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
                    Start a poster
                  </button>
                  <button type="button" onClick={openCreateDialog}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400">
                    Custom size
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Recommended templates — a curated static selection (not personalized) */}
        <section className="mb-12">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Recommended templates</h2>
              <p className="mt-0.5 text-xs text-slate-400">A curated selection to get you started.</p>
            </div>
            <button onClick={() => router.push("/templates")} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
              See all <ArrowRight size={15} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {getFeatured().map((t) => (
              <TemplateCard key={t.id} template={t} onPreview={setPreview} onError={setError} />
            ))}
          </div>
        </section>

        {/* Your designs (from your account) */}
        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Your designs</h2>
            <div className="flex items-center gap-2">
              {listState === "ok" && projects && projects.length > 0 && (
                <>
                  <div className="relative">
                    <label htmlFor="design-search" className="sr-only">Search your designs</label>
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input id="design-search" type="search" value={designQuery} onChange={(e) => setDesignQuery(e.target.value)} placeholder="Search your designs…"
                      aria-label="Search your designs"
                      className="w-44 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-sm outline-none focus:border-brand-400 sm:w-56" />
                  </div>
                  {(() => {
                    const formats = [...new Set(projects.map((p) => p.type))];
                    if (formats.length < 2) return null; // only meaningful with a mix
                    return (
                      <select value={designFormat} onChange={(e) => setDesignFormat(e.target.value)} aria-label="Filter your designs by format"
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-600 outline-none focus:border-brand-400">
                        <option value="all">All formats</option>
                        {formats.map((t) => <option key={t} value={t}>{formatLabelFor(t)}</option>)}
                      </select>
                    );
                  })()}
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort designs"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-600 outline-none focus:border-brand-400">
                    <option value="recent">Last edited</option>
                    <option value="name">Name (A–Z)</option>
                  </select>
                </>
              )}
            </div>
          </div>

          {listState === "signedout" ? (
            <div className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 py-16 text-slate-500">
              <LogIn size={28} className="text-slate-400" />
              <span className="text-sm font-medium">Sign in to see and save your designs</span>
              <button type="button" onClick={() => requireAuthThen("/")} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Sign in or create an account</button>
            </div>
          ) : listState === "error" ? (
            <div className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/40 py-16 text-slate-500">
              <AlertTriangle size={28} className="text-rose-400" />
              <span className="text-sm font-medium">Couldn’t load your designs</span>
              <span className="text-xs text-slate-400">Check your connection, then try again.</span>
              <button type="button" onClick={load} className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : listState === "loading" || projects === null ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-video animate-pulse rounded-2xl bg-slate-200" />)}
            </div>
          ) : projects.length === 0 ? (
            <button type="button" onClick={openCreateDialog}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 py-16 text-slate-400 transition hover:border-brand-400 hover:text-brand-600">
              <Sparkles size={30} />
              <span className="text-sm font-medium">No designs yet — create your first one</span>
              <span className="text-xs">Pick a template or a blank format above</span>
            </button>
          ) : (() => {
            const q = designQuery.trim().toLowerCase();
            const filtering = q !== "" || designFormat !== "all";
            const all = projects
              .filter((p) => !q || (p.name || "").toLowerCase().includes(q))
              .filter((p) => designFormat === "all" || p.type === designFormat)
              .sort((a, b) => (sortBy === "name" ? (a.name || "").localeCompare(b.name || "") : (b.updatedAt || 0) - (a.updatedAt || 0)));
            if (all.length === 0) return <p className="py-10 text-center text-sm text-slate-400">No designs match your search or filter.</p>;
            // When filtering we show every match; otherwise cap the recent grid
            // with a "Show all" expander (all designs are already loaded).
            const capped = filtering || showAll ? all : all.slice(0, RECENT_CAP);
            return (
              <>
                <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {capped.map((p) => (
                    <li key={p.id}>
                      <DesignCard p={p} userId={userId} onOpen={(id) => router.push(`/editor/${id}`)} onRename={handleRename} onDuplicate={handleDuplicate} onDelete={handleDelete} />
                    </li>
                  ))}
                </ul>
                {!filtering && !showAll && all.length > RECENT_CAP && (
                  <div className="mt-6 text-center">
                    <button type="button" onClick={() => setShowAll(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-400">
                      Show all {all.length} designs
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </section>
      </main>

      <NewDesignDialog open={showNew} onClose={() => setShowNew(false)} onCreate={quickCreate} />
      {preview && <TemplatePreviewModal template={preview} onClose={() => setPreview(null)} onError={setError} />}
    </div>
  );
}

function DesignCard({ p, userId, onOpen, onRename, onDuplicate, onDelete }) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(p.name || "");
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState(null);
  const menuRef = useRef(null);
  const popRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => { setName(p.name || ""); }, [p.name]);
  useEffect(() => {
    if (!menu) return;
    function onDown(e) {
      if (menuRef.current?.contains(e.target)) return;
      if (popRef.current?.contains(e.target)) return;
      setMenu(false);
    }
    function onKey(e) { if (e.key === "Escape") setMenu(false); }
    function onMove() { setMenu(false); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [menu]);

  function openMenu() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const menuW = 160, menuH = 136, gap = 4;
    let left = Math.min(r.right - menuW, window.innerWidth - 8 - menuW);
    if (left < 8) left = 8;
    let top = r.bottom + gap;
    if (top + menuH > window.innerHeight - 8) {
      const above = r.top - menuH - gap;
      top = above >= 8 ? above : Math.max(8, window.innerHeight - 8 - menuH);
    }
    setPos({ top, left, width: menuW });
    setMenu(true);
  }

  async function commitRename() {
    const v = name.trim();
    setRenaming(false);
    if (v && v !== p.name) await onRename(p, v);
    else setName(p.name || "");
  }
  async function duplicate() {
    setMenu(false);
    setBusy(true);
    try { await onDuplicate(p); } finally { setBusy(false); }
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-brand-400 hover:shadow-md">
      <button type="button" onClick={() => onOpen(p.id)} className="relative block aspect-video w-full overflow-hidden bg-slate-50">
        <DesignThumb project={p} userId={userId} />
      </button>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setName(p.name || ""); setRenaming(false); } }}
              className="w-full rounded border border-brand-400 px-1.5 py-0.5 text-sm font-semibold text-slate-800 outline-none" />
          ) : (
            <p className="truncate text-sm font-semibold text-slate-800" title={p.name || "Untitled"} onDoubleClick={() => setRenaming(true)}>{p.name || "Untitled"}</p>
          )}
          <p className="truncate text-[11px] text-slate-400">{formatLabelFor(p.type)} · {p.width} × {p.height}</p>
          <p className="text-[11px] text-slate-400">Edited {formatDate(p.updatedAt)}</p>
        </div>
        <div className="relative" ref={menuRef}>
          <button ref={btnRef} type="button" aria-label="Design actions" aria-haspopup="menu" aria-expanded={menu}
            onClick={() => (menu ? setMenu(false) : openMenu())}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <MoreVertical size={16} />
          </button>
          {menu && pos && createPortal(
            <div ref={popRef} role="menu" style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
              className="z-[200] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
              <button type="button" role="menuitem" onClick={() => { setMenu(false); setRenaming(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"><Pencil size={14} /> Rename</button>
              <button type="button" role="menuitem" onClick={duplicate} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"><Copy size={14} /> Duplicate</button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); onDelete(p); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"><Trash2 size={14} /> Delete</button>
            </div>,
            document.body
          )}
        </div>
      </div>
      {busy && <div className="absolute inset-0 flex items-center justify-center bg-white/60"><Loader2 size={18} className="animate-spin text-brand-600" /></div>}
    </div>
  );
}
