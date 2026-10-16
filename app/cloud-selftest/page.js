"use client";

/**
 * Live cloud integration self-test — DEV ONLY (gated below).
 *
 * Runs the real sync code paths against the configured Supabase project using
 * the signed-in browser session: create → push → verify asset externalization →
 * sign/download → pull/reopen → conflict detection → verify pre-existing local
 * projects intact → clean up ONLY this run's throwaway project + asset.
 *
 * Cleanup is scoped precisely: it deletes only the test project id created here
 * and only the asset rows that appeared between a before/after snapshot (and a
 * unique per-run image guarantees a fresh asset so dedup can't mask it). It
 * never deletes real projects or unrelated assets. On failure it prints the
 * actual Supabase error and the ids/paths needed to retry cleanup by hand.
 */

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase, DESIGNS_BUCKET } from "@/lib/supabase/client";
import { getDatabase, listProjects, createProject, getProject, saveProject, deleteProject } from "@/lib/db/projects";
import { syncPushProject, syncPull } from "@/lib/sync/sync";

const TEST_NAME = "__cloud_selftest__";

// A unique image per run (distinct bytes → distinct sha256 → always a fresh
// asset the test owns and can clean up; no dedup collisions with real assets).
function uniqueImageDataUrl() {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2">` +
    `<rect width="2" height="2" fill="#0099ff"/>` +
    `<desc>selftest-${Date.now()}-${Math.random().toString(36).slice(2)}</desc></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export default function CloudSelfTest() {
  const { configured, user } = useAuth();
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);

  // Requirement 5: cannot be exposed in production.
  if (process.env.NODE_ENV === "production") {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-bold text-slate-800">Not available</h1>
        <p className="mt-2 text-sm text-slate-500">
          The cloud self-test is disabled outside development.
        </p>
      </div>
    );
  }

  function add(ok, label, detail) {
    setLog((l) => [...l, { ok, label, detail: detail != null ? String(detail) : "" }]);
  }

  async function run() {
    setLog([]);
    setRunning(true);
    const supabase = getSupabase();
    const db = getDatabase();

    let testProjectId = null;
    let createdAssets = []; // [{ id, storage_path }] created by THIS run only

    try {
      if (!supabase || !user) {
        add(false, "Preconditions", "Not signed in / cloud not configured.");
        return;
      }
      add(true, "Signed in", user.email);

      // Clear any leftover LOCAL test projects from a previous run (safe: exact name).
      const existing = await listProjects();
      for (const p of existing.filter((p) => p.name === TEST_NAME)) {
        await deleteProject(p.id);
        await db.sync_state.delete(`project:${p.id}`).catch(() => {});
      }
      const before = await listProjects();
      const beforeIds = before.map((p) => p.id);
      add(true, "Existing local projects snapshot", `${before.length} real project(s)`);

      // Snapshot cloud asset ids BEFORE push (to scope cleanup precisely).
      const { data: assetsBefore, error: abErr } = await supabase
        .from("assets").select("id").eq("owner", user.id);
      if (abErr) throw abErr;
      const beforeAssetIds = new Set((assetsBefore || []).map((a) => a.id));

      // 1) Create a local test project with a unique embedded image.
      const project = await createProject({ name: TEST_NAME, type: "youtube-thumbnail" });
      testProjectId = project.id;
      const page0 = project.pages[0];
      const docWithImage = JSON.stringify({
        version: "7.4.0",
        background: "#ffffff",
        objects: [{ type: "image", left: 10, top: 10, width: 2, height: 2, src: uniqueImageDataUrl() }],
      });
      await saveProject(project.id, { pages: [{ ...page0, json: docWithImage }], activePageId: page0.id });
      add(true, "Created local test project (with image)", project.id);

      // 2) Push to Supabase.
      const pushed = await syncPushProject(project.id, user.id);
      add(pushed.status === "ok", "Push to cloud", `status=${pushed.status}`);
      if (pushed.status !== "ok") throw new Error("push did not return ok");

      // 3) Verify the image became an asset ref (not base64) + an asset row was created.
      const { data: cloudPages, error: cpErr } = await supabase
        .from("pages").select("doc").eq("project_id", project.id);
      if (cpErr) throw cpErr;
      const docStr = JSON.stringify(cloudPages?.[0]?.doc ?? {});
      const hasAssetRef = /asset:\/\/[0-9a-f-]{36}/.test(docStr);
      const hasBase64 = docStr.includes("data:image/");
      add(hasAssetRef && !hasBase64, "Image externalized to asset ref in cloud",
        `asset_ref=${hasAssetRef} base64_present=${hasBase64}`);

      const { data: assetsAfter, error: aaErr } = await supabase
        .from("assets").select("id, storage_path").eq("owner", user.id);
      if (aaErr) throw aaErr;
      createdAssets = (assetsAfter || []).filter((a) => !beforeAssetIds.has(a.id));
      add(createdAssets.length >= 1, "Asset row created by this run", `${createdAssets.length} new asset(s)`);
      if (createdAssets.length === 0) throw new Error("no new asset row detected");

      // 4) Resolve asset to a signed URL and fetch it.
      const { data: signed, error: sErr } = await supabase.storage
        .from(DESIGNS_BUCKET).createSignedUrl(createdAssets[0].storage_path, 120);
      if (sErr) throw sErr;
      const dlOk = await fetch(signed.signedUrl).then((r) => r.ok).catch(() => false);
      add(dlOk, "Signed URL resolves & asset downloads", signed.signedUrl.slice(0, 56) + "…");

      // 5) Pull back into a clean local state (simulate another device).
      await deleteProject(project.id);
      await db.sync_state.delete(`project:${project.id}`).catch(() => {});
      const gone = await getProject(project.id);
      add(!gone, "Removed local copy", "deleted locally");
      const pull = await syncPull(user.id);
      const reopened = await getProject(project.id);
      const reopenedDoc = reopened?.pages?.[0]?.json || "";
      const resolvedBack = /https?:\/\//.test(reopenedDoc) && !reopenedDoc.includes("asset://");
      add(!!reopened && resolvedBack, "Pull + reopen (asset resolved to URL)",
        `pulled=${pull.pulled} conflicts=${pull.conflicts.length} resolved=${resolvedBack}`);

      // 6) Conflict detection: make the server copy newer than our synced base.
      const { error: upErr } = await supabase
        .from("projects").update({ name: TEST_NAME + " (remote edit)" }).eq("id", project.id);
      if (upErr) throw upErr;
      const conflict = await syncPushProject(project.id, user.id);
      add(conflict.status === "conflict", "Conflict detected (not overwritten)", `status=${conflict.status}`);

      // 7) Pre-existing local projects intact?
      const afterList = await listProjects();
      const afterIds = new Set(afterList.map((p) => p.id));
      const allPresent = beforeIds.every((id) => afterIds.has(id));
      add(allPresent, "Pre-existing local projects intact", `${beforeIds.length} still present`);

      add(true, "ALL STEPS COMPLETE", "see per-step results above");
    } catch (err) {
      add(false, "ERROR", err?.message || err);
    } finally {
      // Cleanup — correct Supabase pattern: await + inspect { error }. Scoped to
      // exactly this run's project + assets. Collects actual errors for retry.
      const cleanupErrors = [];

      if (testProjectId && supabase) {
        const { error: projErr } = await supabase.from("projects").delete().eq("id", testProjectId);
        if (projErr) cleanupErrors.push(`projects.delete(${testProjectId}): ${projErr.message}`);

        for (const a of createdAssets) {
          const { error: rmErr } = await supabase.storage.from(DESIGNS_BUCKET).remove([a.storage_path]);
          if (rmErr) cleanupErrors.push(`storage.remove(${a.storage_path}): ${rmErr.message}`);
          const { error: delErr } = await supabase.from("assets").delete().eq("id", a.id);
          if (delErr) cleanupErrors.push(`assets.delete(${a.id}): ${delErr.message}`);
        }
      }
      // Local cleanup (Dexie promises; guarded individually).
      if (testProjectId) {
        try { await deleteProject(testProjectId); } catch (e) { cleanupErrors.push(`local deleteProject: ${e?.message || e}`); }
        try { await db.sync_state.delete(`project:${testProjectId}`); } catch (e) { cleanupErrors.push(`local sync_state: ${e?.message || e}`); }
      }

      if (cleanupErrors.length === 0) {
        add(true, "Cleanup", "test project + asset removed (cloud + local)");
      } else {
        add(false, "Cleanup FAILED — actual errors", cleanupErrors.join(" | "));
        // Preserve enough info to retry cleanup safely.
        add(false, "Retry info (delete these manually)",
          JSON.stringify({ projectId: testProjectId, assets: createdAssets }));
      }
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-bold text-slate-800">Cloud integration self-test</h1>
      <p className="mt-1 text-sm text-slate-500">
        Runs the live push/pull/asset/conflict flow with your session. Creates and
        then deletes a throwaway project; your real designs are not touched.
      </p>

      {!configured && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Supabase is not configured (missing env vars).
        </p>
      )}
      {configured && !user && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Please sign in on the home page first, then return here.
        </p>
      )}

      <button
        type="button"
        onClick={run}
        disabled={running || !configured || !user}
        className="mt-4 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {running ? "Running…" : "Run self-test"}
      </button>

      <ul className="mt-6 space-y-1.5 font-mono text-xs">
        {log.map((e, i) => (
          <li key={i} className={e.ok ? "text-emerald-700" : "text-rose-700"}>
            {e.ok ? "✓" : "✗"} {e.label}
            {e.detail ? <span className="text-slate-400"> — {e.detail}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
