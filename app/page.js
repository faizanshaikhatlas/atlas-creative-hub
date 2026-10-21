"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, ImageOff, Search, Sparkles, ArrowRight, MoreVertical, Pencil, Copy, Tag, Cloud, CloudOff, UploadCloud, AlertTriangle, Check, Clock } from "lucide-react";
import {
  listProjects,
  createProject,
  duplicateProject,
  renameProject,
  setProjectTags,
  SIZE_PRESETS,
} from "@/lib/db/projects";
import { classifySyncStatus, listProjectSyncStates, deleteDesign, isOwnedByUser, syncPull, pushProjectSafe } from "@/lib/sync/sync";
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

// Popular quick-create formats (ids map to SIZE_PRESETS).
const POPULAR = ["youtube-thumbnail", "instagram-post", "instagram-story", "presentation", "facebook-post", "youtube-banner"];

function formatDate(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

export default function HomePage() {
  const router = useRouter();
  const { configured, loading: authLoading, user, dbScope, active, online } = useAuth();
  const [projects, setProjects] = useState(null); // null = loading
  const [syncStates, setSyncStates] = useState({});
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState("");
  const [designQuery, setDesignQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent"); // "recent" | "name"
  const [tagFilter, setTagFilter] = useState("all");
  const [error, setError] = useState(null);
  const [deleteMsg, setDeleteMsg] = useState(null); // { tone: "ok"|"warn", text }
  // Automatic-sync status for the header chip.
  const [syncState, setSyncState] = useState("idle"); // idle|syncing|synced|offline|failed|pending

  const userId = user?.id ?? null;
  // Cloud is authoritative only for a signed-in, APPROVED owner who is online.
  const cloudActive = configured && !!userId && active && online;

  // Read the local cache (per-account IndexedDB) into the dashboard.
  async function loadLocal() {
    const [list, states] = await Promise.all([
      listProjects(),
      listProjectSyncStates().catch(() => ({})),
    ]);
    setProjects(list);
    setSyncStates(states || {});
    return { list, states: states || {} };
  }

  // One automatic reconcile: pull the owner's cloud designs into the local cache
  // (tombstone-aware — deleted designs never return), render them, then push any
  // locally-changed owned designs back up. No manual Sync button, no import.
  async function refresh() {
    try {
      if (!cloudActive) {
        // Guest, pending approval, or offline → show the local cache as-is. For a
        // signed-in-but-unapproved user this is only their own scoped designs.
        await loadLocal();
        setSyncState(configured && userId && !active ? "pending" : online ? "idle" : "offline");
        return;
      }
      setSyncState("syncing");
      let pullOk = true;
      try {
        await syncPull(userId); // cloud → local cache
      } catch {
        pullOk = false;
      }
      const { list, states } = await loadLocal();
      // Auto-push owned designs whose local edits aren't in the cloud yet.
      let pushFailed = false;
      const dirty = list.filter(
        (p) => isOwnedByUser(p, userId) && ["needed", "failed"].includes(classifySyncStatus(p, states[p.id], { configured, userId }))
      );
      for (const p of dirty) {
        const res = await pushProjectSafe(p.id, userId);
        if (res.status !== "ok" && res.status !== "skipped") pushFailed = true;
      }
      if (dirty.length) await loadLocal(); // refresh badges after pushes
      setSyncState(pullOk && !pushFailed ? "synced" : "failed");
    } catch (err) {
      console.error(err);
      setError("Local storage (IndexedDB) is unavailable in this browser. Designs cannot be saved.");
      setProjects([]);
    }
  }

  // Clear immediately on account switch / sign-out so a previous account's
  // designs can never linger on screen while the new account's load runs.
  useEffect(() => {
    setProjects(null);
    setSyncStates({});
  }, [dbScope]);

  // Automatically load + sync whenever auth settles or connectivity/approval
  // changes (e.g. reconnecting, or an admin approving the account mid-session).
  useEffect(() => {
    if (configured && authLoading) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbScope, configured, authLoading, active, online]);

  async function quickCreate({ type, width, height } = {}) {
    setShowNew(false);
    setCreating(true);
    setError(null);
    try {
      const project = await createProject({ name: "Untitled design", type: type || "youtube-thumbnail", width, height });
      router.push(`/editor/${project.id}`);
    } catch (err) {
      console.error(err);
      setCreating(false);
      setError("Could not create a new design.");
    }
  }

  async function handleDelete(p) {
    const owned = isOwnedByUser(p, userId);
    const name = p.name || "this design";
    const scopeMsg = owned
      ? `Delete “${name}”? This permanently removes it from this device and your cloud account. This cannot be undone.`
      : `Delete “${name}”? This removes it from this device. It isn’t saved to any cloud account. This cannot be undone.`;
    if (!window.confirm(scopeMsg)) return;
    setDeleteMsg(null);
    try {
      const res = await deleteDesign(p, { userId, configured });
      await refresh();
      if (res.cloudPending) {
        setDeleteMsg({ tone: "warn", text: `“${name}” was removed from this device. Its cloud copy couldn’t be deleted yet — it will retry on your next sync.` });
      } else if (res.scope === "cloud") {
        setDeleteMsg({ tone: "ok", text: `“${name}” was permanently deleted from this device and your cloud account.` });
      }
    } catch (err) {
      console.error(err);
      setError("Could not delete the design.");
    }
  }

  async function handleDuplicate(id) {
    try { await duplicateProject(id); refresh(); }
    catch (err) { console.error(err); setError("Could not duplicate the design."); }
  }

  async function handleRename(id, name) {
    try { await renameProject(id, name); refresh(); }
    catch (err) { console.error(err); setError("Could not rename the design."); }
  }

  async function handleSetTags(id, tags) {
    try { await setProjectTags(id, tags); refresh(); }
    catch (err) { console.error(err); setError("Could not update tags."); }
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
            <SyncStatusChip state={syncState} />
            <AccountMenu />
            <button type="button" onClick={() => setShowNew(true)} disabled={creating}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create a design
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pb-20 sm:px-6">
        {/* Hero + search */}
        <section className="py-10 text-center sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            What will you design today?
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            Start from a template or a blank canvas. Everything is saved on this device — no sign-in needed.
          </p>
          <form onSubmit={submitSearch} className="mx-auto mt-6 flex max-w-xl items-center">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates — “sale”, “launch”, “menu”, “admissions”…"
                className="w-full rounded-l-xl border border-r-0 border-slate-200 bg-white py-3 pl-11 pr-3 text-sm outline-none focus:border-brand-400"
                aria-label="Search templates"
              />
            </div>
            <button type="submit" className="rounded-r-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">
              Search
            </button>
          </form>
        </section>

        {error && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
        )}

        {configured && userId && !active && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your account is awaiting administrator approval. Your designs are saved on this device and will
            sync to your cloud account automatically once you&apos;re approved.
          </div>
        )}
        {deleteMsg && (
          <div className={
            "mb-6 rounded-lg border px-4 py-3 text-sm " +
            (deleteMsg.tone === "warn"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800")
          }>
            {deleteMsg.text}
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

        {/* Recent designs */}
        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Your recent designs</h2>
            {projects && projects.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={designQuery}
                    onChange={(e) => setDesignQuery(e.target.value)}
                    placeholder="Search your designs…"
                    className="w-44 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-sm outline-none focus:border-brand-400 sm:w-56"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-600 outline-none focus:border-brand-400"
                  aria-label="Sort designs"
                >
                  <option value="recent">Last edited</option>
                  <option value="name">Name (A–Z)</option>
                </select>
              </div>
            )}
          </div>

          {projects && projects.length > 0 && (() => {
            const allTags = [...new Set(projects.flatMap((p) => p.tags || []))].sort((a, b) => a.localeCompare(b));
            if (!allTags.length) return null;
            return (
              <div className="ds-scroll mb-4 flex gap-2 overflow-x-auto pb-1">
                <HomeChip active={tagFilter === "all"} onClick={() => setTagFilter("all")}>All</HomeChip>
                {allTags.map((t) => (
                  <HomeChip key={t} active={tagFilter === t} onClick={() => setTagFilter(t)}>#{t}</HomeChip>
                ))}
              </div>
            );
          })()}

          {projects === null ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-video animate-pulse rounded-2xl bg-slate-200" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <button type="button" onClick={() => setShowNew(true)}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 py-16 text-slate-400 transition hover:border-brand-400 hover:text-brand-600">
              <Sparkles size={30} />
              <span className="text-sm font-medium">No designs yet — create your first one</span>
              <span className="text-xs">Pick a template or a blank format above</span>
            </button>
          ) : (() => {
            const q = designQuery.trim().toLowerCase();
            const visible = projects
              .filter((p) => !q || (p.name || "").toLowerCase().includes(q))
              .filter((p) => tagFilter === "all" || (p.tags || []).includes(tagFilter))
              .sort((a, b) =>
                sortBy === "name"
                  ? (a.name || "").localeCompare(b.name || "")
                  : (b.updatedAt || 0) - (a.updatedAt || 0)
              );
            if (visible.length === 0) {
              return <p className="py-10 text-center text-sm text-slate-400">No designs match your search or tag filter.</p>;
            }
            return (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {visible.map((p) => (
                  <li key={p.id}>
                    <DesignCard
                      p={p}
                      status={classifySyncStatus(p, syncStates[p.id], { configured, userId })}
                      onOpen={(id) => router.push(`/editor/${id}`)}
                      onRename={handleRename}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                      onSetTags={handleSetTags}
                    />
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

// Visual spec for each cloud state. "local" = on this device only; "synced" =
// confirmed in the signed-in user's cloud; "needed" = owned but local edits not
// yet uploaded; "failed" = last upload failed.
const SYNC_BADGE = {
  local: { label: "On this device", Icon: CloudOff, cls: "bg-slate-100 text-slate-500" },
  synced: { label: "Synced", Icon: Check, cls: "bg-emerald-100 text-emerald-700" },
  needed: { label: "Sync needed", Icon: UploadCloud, cls: "bg-amber-100 text-amber-700" },
  failed: { label: "Sync failed", Icon: AlertTriangle, cls: "bg-rose-100 text-rose-700" },
};

function SyncBadge({ status }) {
  const spec = SYNC_BADGE[status] || SYNC_BADGE.local;
  const { label, Icon, cls } = spec;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`} title={label}>
      <Icon size={11} /> {label}
    </span>
  );
}

function DesignCard({ p, status = "local", onOpen, onRename, onDuplicate, onDelete, onSetTags }) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(p.name || "");
  const [editingTags, setEditingTags] = useState(false);
  const [tagsValue, setTagsValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState(null); // fixed-position coords for the portal menu
  const menuRef = useRef(null); // trigger wrapper
  const popRef = useRef(null); // portal menu
  const btnRef = useRef(null); // three-dot button (anchor)

  useEffect(() => { setName(p.name || ""); }, [p.name]);
  useEffect(() => {
    if (!menu) return;
    function onDown(e) {
      if (menuRef.current?.contains(e.target)) return;
      if (popRef.current?.contains(e.target)) return;
      setMenu(false);
    }
    function onKey(e) { if (e.key === "Escape") setMenu(false); }
    // The menu is fixed-positioned from the button's rect, so any scroll or
    // resize invalidates it — close rather than let it drift.
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

  // Open the menu anchored to the button, flipping above / clamping to the
  // viewport so it stays fully visible for any card position or screen edge.
  function openMenu() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const menuW = 160;
    const menuH = 176; // ~4 items + padding
    const gap = 4;
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
    if (v && v !== p.name) await onRename(p.id, v);
    else setName(p.name || "");
  }
  async function duplicate() {
    setMenu(false);
    setBusy(true);
    try { await onDuplicate(p.id); } finally { setBusy(false); }
  }
  function startTags() {
    setMenu(false);
    setTagsValue((p.tags || []).join(", "));
    setEditingTags(true);
  }
  async function commitTags() {
    setEditingTags(false);
    const parsed = tagsValue.split(",").map((t) => t.trim()).filter(Boolean);
    await onSetTags?.(p.id, parsed);
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-brand-400 hover:shadow-md">
      <button type="button" onClick={() => onOpen(p.id)} className="relative block aspect-video w-full overflow-hidden bg-slate-100">
        {p.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.thumbnail} alt={p.name} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300"><ImageOff size={26} /></div>
        )}
      </button>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") { setName(p.name || ""); setRenaming(false); }
              }}
              className="w-full rounded border border-brand-400 px-1.5 py-0.5 text-sm font-semibold text-slate-800 outline-none"
            />
          ) : (
            <p
              className="truncate text-sm font-semibold text-slate-800"
              title={p.name || "Untitled"}
              onDoubleClick={() => setRenaming(true)}
            >
              {p.name || "Untitled"}
            </p>
          )}
          <p className="text-[11px] text-slate-400">Edited {formatDate(p.updatedAt)} · {p.width}×{p.height}</p>
          <div className="mt-1"><SyncBadge status={status} /></div>
          {editingTags ? (
            <input
              autoFocus
              value={tagsValue}
              onChange={(e) => setTagsValue(e.target.value)}
              onBlur={commitTags}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTags();
                if (e.key === "Escape") setEditingTags(false);
              }}
              placeholder="tags, comma, separated"
              className="mt-1 w-full rounded border border-brand-400 px-1.5 py-0.5 text-[11px] text-slate-700 outline-none"
            />
          ) : (
            (p.tags || []).length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {(p.tags || []).slice(0, 3).map((t) => (
                  <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">#{t}</span>
                ))}
                {(p.tags || []).length > 3 && <span className="text-[10px] text-slate-400">+{(p.tags || []).length - 3}</span>}
              </div>
            )
          )}
        </div>
        <div className="relative" ref={menuRef}>
          <button
            ref={btnRef}
            type="button"
            aria-label="Design actions"
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => (menu ? setMenu(false) : openMenu())}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <MoreVertical size={16} />
          </button>
          {menu && pos && createPortal(
            <div
              ref={popRef}
              role="menu"
              style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
              className="z-[200] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
            >
              <button type="button" role="menuitem" onClick={() => { setMenu(false); setRenaming(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">
                <Pencil size={14} /> Rename
              </button>
              <button type="button" role="menuitem" onClick={duplicate} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">
                <Copy size={14} /> Duplicate
              </button>
              <button type="button" role="menuitem" onClick={startTags} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">
                <Tag size={14} /> Edit tags
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); onDelete(p); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50">
                <Trash2 size={14} /> Delete
              </button>
            </div>,
            document.body
          )}
        </div>
      </div>
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60">
          <Loader2 size={18} className="animate-spin text-brand-600" />
        </div>
      )}
    </div>
  );
}

// Unobtrusive automatic-sync status in the header. Nothing is shown for guests
// or when idle, so the local-first experience stays visually unchanged.
function SyncStatusChip({ state }) {
  const map = {
    syncing: { label: "Syncing…", Icon: Loader2, cls: "text-slate-500", spin: true },
    synced: { label: "Synced", Icon: Cloud, cls: "text-emerald-600" },
    offline: { label: "Offline", Icon: CloudOff, cls: "text-slate-400" },
    failed: { label: "Sync failed", Icon: AlertTriangle, cls: "text-amber-600" },
    pending: { label: "Awaiting approval", Icon: Clock, cls: "text-amber-600" },
  };
  const s = map[state];
  if (!s) return null;
  const { label, Icon, cls, spin } = s;
  return (
    <span className={`hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium sm:inline-flex ${cls}`} title={label}>
      <Icon size={15} className={spin ? "animate-spin" : ""} /> <span className="hidden md:inline">{label}</span>
    </span>
  );
}

function HomeChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition " +
        (active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")
      }
    >
      {children}
    </button>
  );
}
