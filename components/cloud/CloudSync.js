"use client";

import { useEffect, useRef, useState } from "react";
import { Cloud, Loader2, Check, AlertTriangle, UploadCloud } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { syncPushAll, syncPull } from "@/lib/sync/sync";

/**
 * Deliberate, consent-based cloud backup/import for the SIGNED-IN user.
 *
 * Guest safety: renders nothing unless cloud is configured AND a user is signed
 * in, so guests never see or trigger cloud access (and the sync functions are
 * no-ops without a userId; RLS blocks the anon role regardless).
 *
 * Non-destructive by design: the user must click "Sync now" (never automatic).
 * The push stamps every row with owner = user.id (ownership enforced in code and
 * again by RLS `with check`). The underlying sync layer never deletes local
 * designs and never overwrites a conflicting version — conflicts are reported
 * for the user to resolve, not silently merged.
 */
export default function CloudSync({ onSynced }) {
  const { configured, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  // Authoritative approval gate, resolved server-side (never trusted from the
  // client). null = unknown/loading. The DB RLS enforces the same rule anyway.
  const [me, setMe] = useState(null);
  const ref = useRef(null);
  // When the user signs out this component unmounts; guard against a late sync
  // promise resolving and touching state after that.
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!configured || !user) return;
    let active = true;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => { if (active) setMe(d); })
      .catch(() => { if (active) setMe({ active: false, status: "pending" }); });
    return () => { active = false; };
  }, [configured, user]);

  if (!configured || !user) return null;

  const approved = me?.active === true;

  async function sync() {
    if (!approved) return; // DB RLS also blocks this; avoid a confusing failed attempt.
    setBusy(true);
    setErr(null);
    setResult(null);
    setProgress(null);
    try {
      const push = await syncPushAll(user.id, {
        onProgress: ({ done, total }) => { if (aliveRef.current) setProgress({ done, total }); },
      });
      const pull = await syncPull(user.id);
      if (!aliveRef.current) return; // signed out mid-sync
      const conflicts = [...new Set([...(push.conflicts || []), ...(pull.conflicts || [])])];
      setResult({
        pushed: push.pushed,
        pulled: pull.pulled,
        skipped: push.skipped || 0,
        failed: push.failed || 0,
        conflicts: conflicts.length,
      });
      onSynced?.();
    } catch (e) {
      if (aliveRef.current) setErr(e?.message || "Sync failed.");
    } finally {
      if (aliveRef.current) {
        setBusy(false);
        setProgress(null);
      }
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-400"
      >
        <Cloud size={15} /> <span className="hidden sm:inline">Cloud</span>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <h3 className="text-sm font-semibold text-slate-900">Back up &amp; sync</h3>

          {!approved ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800">
              <p className="flex items-center gap-1.5 font-medium">
                <AlertTriangle size={13} />
                {me?.status === "rejected"
                  ? "Access not granted"
                  : me?.disabled
                  ? "Account disabled"
                  : "Awaiting approval"}
              </p>
              <p className="mt-1 text-amber-700">
                {me?.status === "rejected" || me?.disabled
                  ? "Your account can’t use cloud backup. Your local designs on this device are unaffected."
                  : "An administrator needs to approve your account before cloud backup is available. You can keep working locally in the meantime."}
              </p>
            </div>
          ) : (
            <>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                Uploads this device&apos;s designs to your private cloud account and pulls your cloud
                designs here. Nothing is deleted; conflicting versions are reported for you to review,
                never overwritten.
              </p>

              <button
                type="button"
                onClick={sync}
                disabled={busy}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                {busy ? "Syncing…" : "Sync now"}
              </button>

              {progress && (
                <p className="mt-2 text-[11px] text-slate-400">Uploading {progress.done}/{progress.total}…</p>
              )}
              {result && (
                <div className="mt-3 space-y-1 text-[12px]">
                  <p className="flex items-center gap-1.5 text-emerald-700">
                    <Check size={13} /> Pushed {result.pushed}, pulled {result.pulled}.
                  </p>
                  {result.failed > 0 && (
                    <p className="flex items-center gap-1.5 text-rose-600">
                      <AlertTriangle size={13} /> {result.failed} design(s) failed to upload — they’re marked “Sync failed”; try again.
                    </p>
                  )}
                  {result.skipped > 0 && (
                    <p className="flex items-center gap-1.5 text-slate-500">
                      <AlertTriangle size={13} /> {result.skipped} design(s) skipped — not owned by this account.
                    </p>
                  )}
                  {result.conflicts > 0 && (
                    <p className="flex items-center gap-1.5 text-amber-700">
                      <AlertTriangle size={13} /> {result.conflicts} conflict(s) kept both versions — review needed.
                    </p>
                  )}
                </div>
              )}
              {err && <p className="mt-2 text-[12px] text-rose-600">{err}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
