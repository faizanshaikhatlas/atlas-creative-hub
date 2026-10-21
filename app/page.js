"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, ImageOff, Search, Sparkles, ArrowRight, MoreVertical, Pencil, Copy, Download, LogIn } from "lucide-react";
import { SIZE_PRESETS } from "@/lib/db/projects";
import { apiListProjects, apiCreateProject, apiDeleteProject, apiGetProject, apiUpdateProject } from "@/lib/designs/client";
import { THEMES } from "@/lib/template-catalog/formats";
import NewDesignDialog from "@/components/NewDesignDialog";
import AccountMenu from "@/components/auth/AccountMenu";
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

const POPULAR = ["youtube-thumbnail", "instagram-post", "instagram-story", "presentation", "facebook-post", "youtube-banner"];

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
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null); // transient success/info

  const userId = user?.id ?? null;
  const canEdit = configured && !!userId && active; // approved + signed in

  // Personal designs come ONLY from the authenticated user's cloud account.
  async function load() {
    setError(null);
    if (!configured) { setProjects([]); setListState("ok"); return; }
    if (!userId) { setProjects([]); setListState("signedout"); return; }
    if (!active) { setProjects([]); setListState("pending"); return; }
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

  async function quickCreate({ type, width, height } = {}) {
    if (!configured) { setError("Cloud is not configured for this deployment."); return; }
    if (!userId) { setShowNew(false); requireAuthThen("/"); return; }
    if (!active) { setShowNew(false); setError("Your account is awaiting administrator approval before you can create designs."); return; }
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
            <button type="button" onClick={() => (canEdit ? setShowNew(true) : quickCreate())} disabled={creating}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create a design
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

        {/* Create a design — popular formats */}
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Create a design</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {POPULAR.map((id) => {
              const p = SIZE_PRESETS.find((s) => s.id === id);
              if (!p) return null;
              const landscape = p.width >= p.height;
              return (
                <button key={id} type="button" onClick={() => quickCreate({ type: id })}
                  className="group flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-center transition hover:border-brand-400 hover:shadow-sm">
                  <span className="flex h-16 w-full items-center justify-center">
                    <span className="rounded-md bg-gradient-to-br from-brand-100 to-brand-200 ring-1 ring-brand-300/50"
                      style={{ width: landscape ? 56 : 36, height: landscape ? 32 : 52 }} />
                  </span>
                  <span className="text-xs font-medium text-slate-700">{p.label}</span>
                  <span className="text-[10px] text-slate-400">{p.width}×{p.height}</span>
                </button>
              );
            })}
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

        {/* Your designs (from your account) */}
        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Your designs</h2>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button type="button" onClick={() => router.push("/recover")} title="Import designs saved in this browser into your account"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-400">
                  <Download size={14} /> Recover device designs
                </button>
              )}
              {listState === "ok" && projects && projects.length > 0 && (
                <>
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={designQuery} onChange={(e) => setDesignQuery(e.target.value)} placeholder="Search your designs…"
                      className="w-44 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-sm outline-none focus:border-brand-400 sm:w-56" />
                  </div>
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
          ) : listState === "loading" || projects === null ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-video animate-pulse rounded-2xl bg-slate-200" />)}
            </div>
          ) : projects.length === 0 ? (
            <button type="button" onClick={() => (canEdit ? setShowNew(true) : quickCreate())}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 py-16 text-slate-400 transition hover:border-brand-400 hover:text-brand-600">
              <Sparkles size={30} />
              <span className="text-sm font-medium">No designs yet — create your first one</span>
              <span className="text-xs">Pick a template or a blank format above</span>
            </button>
          ) : (() => {
            const q = designQuery.trim().toLowerCase();
            const visible = projects
              .filter((p) => !q || (p.name || "").toLowerCase().includes(q))
              .sort((a, b) => (sortBy === "name" ? (a.name || "").localeCompare(b.name || "") : (b.updatedAt || 0) - (a.updatedAt || 0)));
            if (visible.length === 0) return <p className="py-10 text-center text-sm text-slate-400">No designs match your search.</p>;
            return (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {visible.map((p) => (
                  <li key={p.id}>
                    <DesignCard p={p} onOpen={(id) => router.push(`/editor/${id}`)} onRename={handleRename} onDuplicate={handleDuplicate} onDelete={handleDelete} />
                  </li>
                ))}
              </ul>
            );
          })()}
        </section>
      </main>

      <NewDesignDialog open={showNew} onClose={() => setShowNew(false)} onCreate={quickCreate} />
    </div>
  );
}

function DesignCard({ p, onOpen, onRename, onDuplicate, onDelete }) {
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
      <button type="button" onClick={() => onOpen(p.id)} className="relative block aspect-video w-full overflow-hidden bg-slate-100">
        <div className="flex h-full w-full items-center justify-center text-slate-300"><ImageOff size={26} /></div>
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
          <p className="text-[11px] text-slate-400">Edited {formatDate(p.updatedAt)} · {p.width}×{p.height}</p>
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
