"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Film, Loader2, ImageOff, LayoutTemplate } from "lucide-react";
import {
  listProjects,
  createProject,
  deleteProject,
  SIZE_PRESETS,
} from "@/lib/db/projects";
import NewDesignDialog from "@/components/NewDesignDialog";
import CloudMenu from "@/components/auth/CloudMenu";

function formatDate(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState(null); // null = loading
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState(null);

  async function refresh() {
    try {
      const list = await listProjects();
      setProjects(list);
    } catch (err) {
      console.error(err);
      setError(
        "Local storage (IndexedDB) is unavailable in this browser. Projects cannot be saved."
      );
      setProjects([]);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate({ type, width, height } = {}) {
    setShowNew(false);
    setCreating(true);
    setError(null);
    try {
      const project = await createProject({
        name: "Untitled design",
        type: type || "youtube-thumbnail",
        width,
        height,
      });
      router.push(`/editor/${project.id}`);
    } catch (err) {
      console.error(err);
      setCreating(false);
      setError("Could not create a new project.");
    }
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!window.confirm("Delete this project? This cannot be undone.")) return;
    try {
      await deleteProject(id);
      refresh();
    } catch (err) {
      console.error(err);
      setError("Could not delete the project.");
    }
  }

  const preset = SIZE_PRESETS[0];

  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* Official ATLAS Creative Hub logo (dark wordmark on light surface) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/atlas-logo.svg"
            alt="ATLAS Creative Hub"
            width={252}
            height={49}
            className="h-10 w-auto sm:h-11"
          />
          <p className="mt-2 text-sm text-slate-500">
            Create and edit thumbnails, banners and social posts in your browser.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CloudMenu onSynced={refresh} />
          <button
            type="button"
            onClick={() => router.push("/templates")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-400 hover:text-brand-700"
          >
            <LayoutTemplate size={18} />
            Templates
          </button>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {creating ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Plus size={18} />
            )}
            New design
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {projects === null ? (
        <div className="flex items-center gap-2 py-20 text-slate-400">
          <Loader2 size={18} className="animate-spin" /> Loading projects…
        </div>
      ) : projects.length === 0 ? (
        <button
          type="button"
          onClick={() => setShowNew(true)}
          disabled={creating}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 py-20 text-slate-400 transition hover:border-brand-400 hover:text-brand-600"
        >
          <Film size={36} />
          <span className="text-sm font-medium">
            No projects yet — create your first design
          </span>
          <span className="text-xs">
            {preset.width} × {preset.height} px
          </span>
        </button>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => router.push(`/editor/${p.id}`)}
                className="group flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-brand-400 hover:shadow-md"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                  {p.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumbnail}
                      alt={p.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                      <ImageOff size={28} />
                    </div>
                  )}
                  <span
                    onClick={(e) => handleDelete(e, p.id)}
                    role="button"
                    aria-label="Delete project"
                    className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-slate-500 opacity-0 shadow-sm transition hover:text-rose-600 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {p.name || "Untitled"}
                    </p>
                    <p className="text-xs text-slate-400">
                      Edited {formatDate(p.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {p.width}×{p.height}
                    </span>
                    {p.pages?.length > 1 && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                        {p.pages.length} pages
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <NewDesignDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
