"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Check, CloudOff, AlertTriangle, Play, Pause,
  Plus, Trash2, Copy, ChevronLeft, ChevronRight, Film,
  LayoutTemplate, Upload, Type, Image as ImageIcon, Music, Shapes,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiUpdateProject } from "@/lib/designs/client";
import {
  parseVideoDoc, withNormalizedScenes, addScene, removeScene, moveScene,
  duplicateScene, sceneIdAfter, setSceneDuration, renameScene, activeSceneIndex,
  VIDEO_LIMITS,
} from "@/lib/video/document";
import { renderSceneToDataURL, renderBlankFrame } from "@/lib/video/build";

// Tools that need media/content editing — still deferred (uploads/text/audio
// batches). Shown disabled and labelled, never presented as working.
const DEFERRED_TOOLS = [
  { label: "Templates", Icon: LayoutTemplate },
  { label: "Uploads", Icon: Upload },
  { label: "Text", Icon: Type },
  { label: "Backgrounds", Icon: ImageIcon },
  { label: "Audio", Icon: Music },
  { label: "Elements", Icon: Shapes },
];

function fmtTime(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
function ratioLabel(w, h) {
  const g = (a, b) => (b ? g(b, a % b) : a);
  const d = g(w, h) || 1;
  return `${w / d}:${h / d}`;
}

/**
 * Video editor — playback + scene-timeline editing.
 *
 * Single source of truth: the timeline document (`doc`). There is exactly ONE
 * "current scene" — the scene under the playhead (`activeSceneIndex(currentTime)`)
 * — so the stage, the selected-scene controls and the document can never show
 * stale/conflicting state. A real requestAnimationFrame clock drives
 * play/pause/seek; the playhead and time readout track it. Scenes can be added,
 * duplicated, removed, reordered and have their durations/names changed; every
 * mutation runs through the pure, normalized ops (sequential starts + total
 * recomputed). The document is saved (server-confirmed) and restored on reopen.
 * Per-clip motion, real video/audio media, in-scene text editing and export are
 * later checkpoints (shown disabled, never faked).
 */
export default function VideoEditor({ project }) {
  const router = useRouter();
  const { user, active } = useAuth();

  const parsed = parseVideoDoc(project.pages?.[0]?.json);
  const [doc, setDocState] = useState(parsed ? withNormalizedScenes(parsed, parsed.scenes) : null);
  const [title, setTitle] = useState(project.name || "Untitled video");
  const [cloud, setCloud] = useState("idle");
  const [dirty, setDirty] = useState(false);
  const [sceneImages, setSceneImages] = useState({});
  const [imagesReady, setImagesReady] = useState(false);
  const expectedUpdatedAt = useRef(project.updatedAt);
  const saveSeq = useRef(0); // guards against a stale async save overwriting a newer one

  // --- Playback clock (real, rAF-driven) ---
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const total = doc?.duration ?? 1;
  const totalRef = useRef(total);
  useEffect(() => { totalRef.current = total; }, [total]);

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
  }, []);

  const tick = useCallback((ts) => {
    if (!playingRef.current) return;
    const last = lastTsRef.current || ts;
    lastTsRef.current = ts;
    const end = totalRef.current;               // read live total (clip edits mid-play)
    const t = timeRef.current + (ts - last) / 1000;
    if (t >= end) { timeRef.current = end; setCurrentTime(end); stop(); return; }
    timeRef.current = t; setCurrentTime(t);
    rafRef.current = requestAnimationFrame(tick);
  }, [stop]);

  const play = useCallback(() => {
    if (!doc) return;
    if (timeRef.current >= totalRef.current) { timeRef.current = 0; setCurrentTime(0); }
    playingRef.current = true; setPlaying(true); lastTsRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);
  }, [doc, tick]);

  const pause = useCallback(() => stop(), [stop]);
  const seek = useCallback((t) => {
    const c = Math.min(totalRef.current, Math.max(0, Number(t) || 0));
    timeRef.current = c; setCurrentTime(c);
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  // Clamp the playhead if the total shrinks (e.g., a scene was shortened/removed).
  useEffect(() => { if (timeRef.current > total) { timeRef.current = total; setCurrentTime(total); } }, [total]);

  // --- Pre-render each scene to an image for the stage + timeline thumbnails.
  // Re-renders when the scene SET/order, size, or a scene's composition/background
  // changes (so the preview updates when scene content changes). ---
  const sceneKey = doc
    ? doc.scenes.map((s) => `${s.id}:${s.background || ""}:${s.doc ? "c" : "b"}`).join(",") + `@${doc.width}x${doc.height}`
    : "";
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setImagesReady(false);
    (async () => {
      const map = {};
      for (const s of doc.scenes) {
        try {
          map[s.id] = s.doc
            ? await renderSceneToDataURL(s.doc, doc.width, doc.height, 1000)
            : await renderBlankFrame(doc.width, doc.height, s.background || doc.background, 1000);
        } catch { map[s.id] = null; }
      }
      if (!cancelled) { setSceneImages(map); setImagesReady(true); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  // --- Document edits (all go through pure, normalized ops) ---
  function applyDoc(next) { setDocState(next); setDirty(true); }
  function doAddScene() {
    const next = addScene(doc, { duration: 3 });
    applyDoc(next);
    seek(next.scenes[next.scenes.length - 1].start); // jump to the new scene
  }
  function doDuplicate(id) {
    const next = duplicateScene(doc, id);
    if (next === doc) return;
    applyDoc(next);
    const copyId = sceneIdAfter(next, id);
    const copy = next.scenes.find((s) => s.id === copyId);
    if (copy) seek(copy.start);
  }
  function doRemoveScene(id) {
    const next = removeScene(doc, id);
    if (next === doc) return;
    applyDoc(next);
    if (timeRef.current > next.duration) seek(next.duration);
  }
  function doMoveScene(id, dir) {
    const next = moveScene(doc, id, dir);
    if (next === doc) return;
    applyDoc(next);
    const moved = next.scenes.find((s) => s.id === id);
    if (moved) seek(moved.start); // keep following the scene you reordered
  }
  function doSetDuration(id, seconds) {
    const d = Math.min(VIDEO_LIMITS.DUR_MAX, Math.max(VIDEO_LIMITS.DUR_MIN, Math.round(Number(seconds) || 0)));
    applyDoc(setSceneDuration(doc, id, d));
  }
  function doRename(id, name) { applyDoc(renameScene(doc, id, name)); }

  // --- Save (server-confirmed, stale-guarded) ---
  async function save() {
    if (!doc) return;
    if (active !== true) { setCloud("pending"); return; }
    stop();
    const seq = ++saveSeq.current;
    setCloud("saving");
    try {
      const res = await apiUpdateProject(
        project.id,
        {
          name: (title || "Untitled video").trim() || "Untitled video",
          type: "video",
          width: doc.width, height: doc.height,
          activePageId: project.activePageId,
          pages: [{
            id: project.pages[0].id, name: project.pages[0].name || "Page 1",
            json: JSON.stringify(doc), background: doc.background || "#000000",
            width: doc.width, height: doc.height,
          }],
        },
        { userId: user?.id, expectedUpdatedAt: expectedUpdatedAt.current }
      );
      if (seq !== saveSeq.current) return; // a newer save superseded this one
      expectedUpdatedAt.current = res?.updatedAt ?? expectedUpdatedAt.current;
      setCloud("saved"); setDirty(false);
    } catch (e) {
      if (seq !== saveSeq.current) return;
      if (e.status === 403) setCloud("pending");
      else if (e.code === "conflict") setCloud("error");
      else if (typeof navigator !== "undefined" && !navigator.onLine) setCloud("offline");
      else setCloud("error");
    }
  }

  useEffect(() => {
    function onBeforeUnload(e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  if (!doc) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-slate-100 p-6 text-center">
        <AlertTriangle size={36} className="text-amber-500" />
        <p className="text-lg font-semibold text-slate-800">This video couldn’t be opened</p>
        <p className="max-w-md text-sm text-slate-500">The video document is missing or invalid. Your other designs are unaffected.</p>
        <button onClick={() => router.push("/")} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Back to dashboard</button>
      </div>
    );
  }

  // The ONE current scene: whatever is under the playhead.
  const curIdx = Math.max(0, activeSceneIndex(doc.scenes, currentTime));
  const current = doc.scenes[curIdx] || doc.scenes[0];
  const stageSrc = current ? sceneImages[current.id] : null;
  const aspect = `${doc.width} / ${doc.height}`;

  const controls = (
    <SceneControls
      scene={current} idx={curIdx} count={doc.scenes.length}
      onRename={doRename} onDuration={doSetDuration}
      onMove={doMoveScene} onDuplicate={doDuplicate} onRemove={doRemoveScene}
    />
  );

  return (
    <div className="flex h-dvh flex-col bg-slate-100">
      {/* Top toolbar */}
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-2">
        <button onClick={() => router.push("/")} title="Back to dashboard" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-slate-600 hover:bg-slate-100">
          <ArrowLeft size={16} /> <span className="hidden sm:inline">Back</span>
        </button>
        <input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} aria-label="Video title"
          className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-sm font-semibold text-slate-800 outline-none hover:border-slate-200 focus:border-brand-400 sm:max-w-sm" />
        <SaveStatus cloud={cloud} dirty={dirty} />
        <div className="ml-auto">
          <button type="button" onClick={save} disabled={cloud === "saving"}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {cloud === "saving" ? <Loader2 size={15} className="animate-spin" /> : null} Save
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left panel (deferred content tools) */}
        <aside className="hidden w-16 shrink-0 flex-col items-center gap-1 border-r border-slate-200 bg-white py-3 sm:flex">
          {DEFERRED_TOOLS.map(({ label, Icon }) => (
            <button key={label} type="button" disabled title={`${label} — arrives in a later update`}
              className="flex w-14 cursor-not-allowed flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium text-slate-300">
              <Icon size={18} /> {label}
            </button>
          ))}
        </aside>

        {/* Center: stage + playback + timeline */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-200/60 p-4">
            <div className="relative max-h-full overflow-hidden rounded-lg bg-black shadow-lg"
              style={{ aspectRatio: aspect, width: doc.width >= doc.height ? "min(100%, 860px)" : "auto", height: doc.width >= doc.height ? "auto" : "min(100%, 66dvh)" }}>
              {stageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stageSrc} alt={`Scene ${curIdx + 1}`} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-500">
                  {imagesReady ? <Film size={28} /> : <Loader2 size={22} className="animate-spin" />}
                </div>
              )}
            </div>
          </div>

          {/* Playback controls + timeline */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
            <div className="mb-2 flex items-center gap-3">
              <button type="button" onClick={playing ? pause : play} aria-label={playing ? "Pause" : "Play"}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700">
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <span className="text-xs font-medium tabular-nums text-slate-600">{fmtTime(currentTime)} / {fmtTime(total)}</span>
              <span className="hidden text-[11px] text-slate-400 sm:inline">Scene {curIdx + 1}/{doc.scenes.length} · {doc.fps} fps · {doc.width}×{doc.height}</span>
              <button type="button" onClick={doAddScene} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-400">
                <Plus size={13} /> Add scene
              </button>
            </div>

            <Ruler total={total} currentTime={currentTime} onSeek={seek} />
            <SceneTrack doc={doc} total={total} curIdx={curIdx} images={sceneImages} onSeek={seek} />
          </div>

          {/* Scene controls on small screens (the right rail is hidden < lg) */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
            {controls}
          </div>
        </main>

        {/* Right: properties (desktop) */}
        <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-200 bg-white p-4 lg:flex">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Video</h3>
            <dl className="space-y-1.5 text-sm">
              <Row label="Dimensions" value={`${doc.width} × ${doc.height}`} />
              <Row label="Aspect" value={ratioLabel(doc.width, doc.height)} />
              <Row label="Frame rate" value={`${doc.fps} fps`} />
              <Row label="Total" value={fmtTime(total)} />
              <Row label="Scenes" value={String(doc.scenes.length)} />
            </dl>
          </div>
          <div className="border-t border-slate-100 pt-4">{controls}</div>
        </aside>
      </div>
    </div>
  );
}

// Selected (= current) scene controls. Rendered in the right rail on desktop and
// below the timeline on small screens, so scene editing is usable on mobile.
function SceneControls({ scene, idx, count, onRename, onDuration, onMove, onDuplicate, onRemove }) {
  if (!scene) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Scene {idx + 1} of {count}
      </h3>
      <label className="mb-1 block text-[11px] font-medium text-slate-500">Name</label>
      <input value={scene.name} onChange={(e) => onRename(scene.id, e.target.value)} aria-label="Scene name"
        className="mb-3 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-400" />

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Start (s)</label>
          <input value={scene.start} readOnly title="Start is set by scene order (sequential)"
            className="w-full cursor-not-allowed rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 text-sm text-slate-400" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Duration (s)</label>
          <input type="number" min={VIDEO_LIMITS.DUR_MIN} max={VIDEO_LIMITS.DUR_MAX} value={scene.duration}
            onChange={(e) => onDuration(scene.id, e.target.value)} aria-label="Scene duration in seconds"
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-400" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onMove(scene.id, -1)} disabled={idx === 0}
          title="Move earlier"
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-400 disabled:opacity-40">
          <ChevronLeft size={13} /> Earlier
        </button>
        <button type="button" onClick={() => onMove(scene.id, 1)} disabled={idx === count - 1}
          title="Move later"
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-400 disabled:opacity-40">
          Later <ChevronRight size={13} />
        </button>
        <button type="button" onClick={() => onDuplicate(scene.id)} disabled={count >= VIDEO_LIMITS.SCENES_MAX}
          title="Duplicate scene"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-400 disabled:opacity-40">
          <Copy size={13} />
        </button>
        <button type="button" onClick={() => onRemove(scene.id)} disabled={count <= 1}
          title={count <= 1 ? "A video needs at least one scene" : "Remove scene"}
          className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40">
          <Trash2 size={13} />
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        Scenes play back-to-back, so a scene’s start is set by its order. Editing a scene’s inner text/media arrives in a later update.
      </p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-700">{value}</dd>
    </div>
  );
}

function SaveStatus({ cloud, dirty }) {
  if (cloud === "saving") return <Pill icon={<Loader2 size={13} className="animate-spin" />} text="Saving…" tone="slate" />;
  if (cloud === "saved" && !dirty) return <Pill icon={<Check size={13} />} text="Saved" tone="green" />;
  if (cloud === "offline") return <Pill icon={<CloudOff size={13} />} text="Offline" tone="amber" />;
  if (cloud === "pending") return <Pill icon={<AlertTriangle size={13} />} text="Awaiting approval" tone="amber" />;
  if (cloud === "error") return <Pill icon={<AlertTriangle size={13} />} text="Save failed" tone="rose" />;
  if (dirty) return <Pill text="Unsaved changes" tone="slate" />;
  return <Pill text="All changes saved" tone="slate" />;
}
function Pill({ icon, text, tone }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-500",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return <span className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:inline-flex ${tones[tone] || tones.slate}`}>{icon}{text}</span>;
}

// Time ruler with click/drag seeking + a live playhead.
function Ruler({ total, currentTime, onSeek }) {
  const ref = useRef(null);
  const draggingRef = useRef(false);
  const step = total <= 15 ? 1 : total <= 60 ? 5 : 10;
  const ticks = [];
  for (let t = 0; t <= total + 0.001; t += step) ticks.push(Math.round(t));

  const seekFromEvent = useCallback((clientX) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onSeek(frac * total);
  }, [onSeek, total]);

  return (
    <div
      ref={ref}
      role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(currentTime)}
      tabIndex={0}
      onPointerDown={(e) => { draggingRef.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); seekFromEvent(e.clientX); }}
      onPointerMove={(e) => { if (draggingRef.current) seekFromEvent(e.clientX); }}
      onPointerUp={() => { draggingRef.current = false; }}
      onKeyDown={(e) => { if (e.key === "ArrowRight") onSeek(Math.min(total, currentTime + 1)); if (e.key === "ArrowLeft") onSeek(Math.max(0, currentTime - 1)); }}
      className="relative ml-20 mb-1 h-5 cursor-pointer border-b border-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
    >
      {ticks.map((t) => (
        <span key={t} className="pointer-events-none absolute top-0 -translate-x-1/2 text-[10px] text-slate-400" style={{ left: `${(t / total) * 100}%` }}>{fmtTime(t)}</span>
      ))}
      <span className="pointer-events-none absolute -top-0.5 bottom-0 w-0.5 bg-brand-600" style={{ left: `${(currentTime / total) * 100}%` }}>
        <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand-600" />
      </span>
    </div>
  );
}

// Scene blocks on a single track, each a real thumbnail + name + duration.
// Clicking a scene seeks to its start (which makes it the current scene).
function SceneTrack({ doc, total, curIdx, images, onSeek }) {
  return (
    <div className="flex items-stretch">
      <div className="flex w-20 shrink-0 items-center text-[11px] font-medium text-slate-400">Scenes</div>
      <div className="relative h-14 flex-1 rounded bg-slate-50">
        {doc.scenes.map((s, i) => {
          const isCurrent = i === curIdx;
          const thumb = images[s.id];
          return (
            <button key={s.id} type="button"
              onClick={() => onSeek(s.start)}
              title={`${s.name} · start ${fmtTime(s.start)} · ${s.duration}s`}
              className={
                "group absolute top-1 bottom-1 flex flex-col overflow-hidden rounded-md border text-left transition " +
                (isCurrent ? "border-brand-500 ring-2 ring-brand-400 " : "border-slate-200 hover:border-brand-300 ")
              }
              style={{ left: `calc(${(s.start / total) * 100}% + 2px)`, width: `calc(${(s.duration / total) * 100}% - 4px)`, minWidth: 28 }}
            >
              <span className="relative min-h-0 flex-1 bg-black">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-slate-500"><Film size={14} /></span>
                )}
                <span className="absolute right-0.5 top-0.5 rounded bg-black/65 px-1 text-[9px] font-medium tabular-nums text-white">{s.duration}s</span>
              </span>
              <span className={"truncate px-1.5 py-0.5 text-[10px] font-medium " + (isCurrent ? "bg-brand-100 text-brand-800" : "bg-white text-slate-600")}>{s.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
