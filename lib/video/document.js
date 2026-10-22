// Video timeline document model (dependency-free). A video project is an ordinary
// project with `type: "video"`; this JSON lives in the page's `doc` (jsonb) exactly
// like a static design's Fabric JSON, so it saves/loads through the existing APIs
// with no schema change. Scenes hold an editable Fabric composition object (`doc`)
// plus timeline timing; media/audio reference Storage assets (asset:// refs), never
// base64. Everything here is validated/clamped before persistence.

export const VIDEO_LIMITS = {
  DUR_MIN: 1, DUR_MAX: 600,   // seconds (total + per scene)
  FPS_MIN: 1, FPS_MAX: 60,
  DIM_MIN: 50, DIM_MAX: 5000,
  SCENES_MAX: 50,
  AUDIO_MAX: 20,
};

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function isString(v) { return typeof v === "string"; }
function clampNum(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}
function clampInt(n, min, max, fallback) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

/** True if a loaded project (or doc) is a video project. */
export function isVideoType(type) { return type === "video"; }

/** A blank video document for a given format. */
export function blankVideoDoc({ width, height, fps, duration, background = "#000000" }) {
  const w = clampInt(width, VIDEO_LIMITS.DIM_MIN, VIDEO_LIMITS.DIM_MAX, 1920);
  const h = clampInt(height, VIDEO_LIMITS.DIM_MIN, VIDEO_LIMITS.DIM_MAX, 1080);
  const d = clampNum(duration, VIDEO_LIMITS.DUR_MIN, VIDEO_LIMITS.DUR_MAX, 10);
  return {
    kind: "video", version: 1,
    width: w, height: h,
    fps: clampInt(fps, VIDEO_LIMITS.FPS_MIN, VIDEO_LIMITS.FPS_MAX, 30),
    duration: d, background,
    scenes: [{ id: uid(), name: "Scene 1", start: 0, duration: d, doc: null }],
    audio: [],
  };
}

/** A video document seeded from a starter's opening-frame composition object. */
export function videoDocFromStarter({ width, height, fps, duration, background, sceneDoc }) {
  const base = blankVideoDoc({ width, height, fps, duration, background: background || "#000000" });
  base.scenes[0].doc = sceneDoc && typeof sceneDoc === "object" ? sceneDoc : null;
  return base;
}

/** Validate + normalize a video document. Returns { ok, value } | { ok:false, error }. */
export function validateVideoDoc(doc) {
  if (!doc || typeof doc !== "object" || doc.kind !== "video") return { ok: false, error: "Not a video document." };
  const width = clampInt(doc.width, VIDEO_LIMITS.DIM_MIN, VIDEO_LIMITS.DIM_MAX, null);
  const height = clampInt(doc.height, VIDEO_LIMITS.DIM_MIN, VIDEO_LIMITS.DIM_MAX, null);
  if (width === null || height === null) return { ok: false, error: "Invalid video dimensions." };
  const fps = clampInt(doc.fps, VIDEO_LIMITS.FPS_MIN, VIDEO_LIMITS.FPS_MAX, 30);
  const duration = clampNum(doc.duration, VIDEO_LIMITS.DUR_MIN, VIDEO_LIMITS.DUR_MAX, 10);

  const scenesIn = Array.isArray(doc.scenes) ? doc.scenes.slice(0, VIDEO_LIMITS.SCENES_MAX) : [];
  const scenes = scenesIn.map((s, i) => ({
    id: isString(s?.id) ? s.id : uid(),
    name: isString(s?.name) ? s.name.slice(0, 80) : `Scene ${i + 1}`,
    start: clampNum(s?.start, 0, VIDEO_LIMITS.DUR_MAX, 0),
    duration: clampNum(s?.duration, 0, VIDEO_LIMITS.DUR_MAX, duration),
    doc: s?.doc && typeof s.doc === "object" ? s.doc : null,
    // Per-scene background (optional) must survive load — blank scenes and the
    // background-editing checkpoint rely on it.
    ...(isString(s?.background) ? { background: s.background.slice(0, 64) } : {}),
  }));
  if (scenes.length === 0) scenes.push({ id: uid(), name: "Scene 1", start: 0, duration, doc: null });

  const audioIn = Array.isArray(doc.audio) ? doc.audio.slice(0, VIDEO_LIMITS.AUDIO_MAX) : [];
  const audio = audioIn.map((a) => ({
    id: isString(a?.id) ? a.id : uid(),
    assetRef: isString(a?.assetRef) ? a.assetRef : null,
    start: clampNum(a?.start, 0, VIDEO_LIMITS.DUR_MAX, 0),
    duration: clampNum(a?.duration, 0, VIDEO_LIMITS.DUR_MAX, 0),
    volume: clampNum(a?.volume, 0, 1, 1),
  }));

  return {
    ok: true,
    value: {
      kind: "video", version: 1,
      width, height, fps, duration,
      background: isString(doc.background) ? doc.background.slice(0, 64) : "#000000",
      scenes, audio,
    },
  };
}

// --- Scene timeline operations (pure, sequential model) ---------------------
// Scenes play back-to-back: each scene's `start` is derived from the durations of
// the scenes before it, so the timeline has no gaps or overlaps. Reordering a
// scene changes when it plays (its start). All ops return a NEW normalized doc.

/** Recompute sequential starts + total duration from scene order/durations. */
export function normalizeScenes(scenes) {
  let t = 0;
  const out = (Array.isArray(scenes) ? scenes : []).map((s, i) => {
    const duration = clampNum(s?.duration, VIDEO_LIMITS.DUR_MIN, VIDEO_LIMITS.DUR_MAX, 3);
    const scene = {
      id: isString(s?.id) ? s.id : uid(),
      name: isString(s?.name) && s.name.trim() ? s.name.slice(0, 80) : `Scene ${i + 1}`,
      start: t, duration,
      doc: s?.doc && typeof s.doc === "object" ? s.doc : null,
      // Preserve any per-scene field the editor set (e.g. background). Every edit
      // runs through normalizeScenes, so dropping these would erase them.
      ...(isString(s?.background) ? { background: s.background.slice(0, 64) } : {}),
    };
    t += duration;
    return scene;
  });
  if (out.length === 0) out.push({ id: uid(), name: "Scene 1", start: 0, duration: 5, doc: null });
  return out;
}

export function sceneTotal(scenes) {
  const sum = (Array.isArray(scenes) ? scenes : []).reduce((a, s) => a + (clampNum(s?.duration, 0, VIDEO_LIMITS.DUR_MAX, 0)), 0);
  return Math.max(VIDEO_LIMITS.DUR_MIN, sum);
}

export function withNormalizedScenes(doc, scenes) {
  const ns = normalizeScenes(scenes);
  return { ...doc, scenes: ns, duration: sceneTotal(ns) };
}

export function addScene(doc, { duration = 3, background } = {}) {
  const scene = { id: uid(), name: `Scene ${doc.scenes.length + 1}`, start: 0, duration, doc: null, background };
  return withNormalizedScenes(doc, [...doc.scenes, scene]);
}

export function removeScene(doc, id) {
  if (doc.scenes.length <= 1) return doc; // keep at least one scene
  return withNormalizedScenes(doc, doc.scenes.filter((s) => s.id !== id));
}

/** Insert a deep copy of a scene immediately after it (new id, "… copy" name). */
export function duplicateScene(doc, id) {
  const i = doc.scenes.findIndex((s) => s.id === id);
  if (i < 0 || doc.scenes.length >= VIDEO_LIMITS.SCENES_MAX) return doc;
  const src = doc.scenes[i];
  const copy = {
    id: uid(),
    name: `${src.name} copy`.slice(0, 80),
    start: 0,
    duration: src.duration,
    // Deep-copy the composition so edits to one scene never bleed into the other.
    doc: src.doc && typeof src.doc === "object" ? JSON.parse(JSON.stringify(src.doc)) : null,
    ...(isString(src.background) ? { background: src.background } : {}),
  };
  const arr = [...doc.scenes];
  arr.splice(i + 1, 0, copy);
  return withNormalizedScenes(doc, arr);
}

/** The id of the scene that follows `id` after a duplicate (the new copy). */
export function sceneIdAfter(doc, id) {
  const i = doc.scenes.findIndex((s) => s.id === id);
  return i >= 0 && doc.scenes[i + 1] ? doc.scenes[i + 1].id : null;
}

export function moveScene(doc, id, dir) {
  const i = doc.scenes.findIndex((s) => s.id === id);
  if (i < 0) return doc;
  const j = i + (dir < 0 ? -1 : 1);
  if (j < 0 || j >= doc.scenes.length) return doc;
  const arr = [...doc.scenes];
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return withNormalizedScenes(doc, arr);
}

export function setSceneDuration(doc, id, duration) {
  return withNormalizedScenes(doc, doc.scenes.map((s) => (s.id === id ? { ...s, duration } : s)));
}

export function renameScene(doc, id, name) {
  return { ...doc, scenes: doc.scenes.map((s) => (s.id === id ? { ...s, name: String(name || "").slice(0, 80) } : s)) };
}

/** Index of the scene playing at time `t` (sequential/contiguous). */
export function activeSceneIndex(scenes, t) {
  if (!Array.isArray(scenes) || scenes.length === 0) return -1;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (t >= s.start && t < s.start + s.duration) return i;
  }
  return scenes.length - 1; // at/after the end → last scene
}

/** Parse a stored page.json string into a validated video doc, or null. */
export function parseVideoDoc(jsonOrObject) {
  try {
    const o = typeof jsonOrObject === "string" ? JSON.parse(jsonOrObject) : jsonOrObject;
    const r = validateVideoDoc(o);
    return r.ok ? r.value : null;
  } catch {
    return null;
  }
}
