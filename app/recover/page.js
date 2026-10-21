"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Download, AlertTriangle, Check, ArrowLeft, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { enumerateLocalDesigns, importDesignsFromDb } from "@/lib/designs/recovery";

function fmt(ts) {
  try { return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return ""; }
}

export default function RecoverPage() {
  const { configured, loading, user, active } = useAuth();
  const [sources, setSources] = useState(null); // null = loading
  const [selected, setSelected] = useState({}); // id -> true
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  const scan = useCallback(async () => {
    try {
      setSources(await enumerateLocalDesigns(user?.id ?? null));
    } catch {
      setSources([]);
    }
  }, [user?.id]);

  useEffect(() => { if (!loading) scan(); }, [loading, scan]);

  function toggle(id) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }
  function selectAll(source, on) {
    setSelected((s) => {
      const next = { ...s };
      source.designs.forEach((d) => { next[d.id] = on; });
      return next;
    });
  }

  async function importSource(source) {
    const ids = source.designs.map((d) => d.id).filter((id) => selected[id]);
    if (!ids.length) { setErr("Select at least one design to import."); return; }
    setErr(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await importDesignsFromDb(source.name, ids, user.id);
      const ok = res.filter((r) => r.ok).length;
      const failed = res.length - ok;
      setResult({ ok, failed });
      await scan();
    } catch (e) {
      setErr(e?.message || "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return <Shell><p className="text-sm text-slate-600">Cloud is not configured for this deployment.</p></Shell>;
  }
  if (loading) {
    return <Shell><p className="inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading…</p></Shell>;
  }
  if (!user) {
    return (
      <Shell>
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <p>Sign in to import designs saved on this device into your account.{" "}
            <Link href="/login?next=/recover" className="font-medium text-brand-700 underline">Sign in</Link></p>
        </div>
      </Shell>
    );
  }
  if (!active) {
    return (
      <Shell>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your account is awaiting administrator approval. Once approved, you can import your on-device designs here.
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="mb-5 text-sm text-slate-500">
        These designs are saved in this browser only. Choose which to import into your account
        (<span className="font-medium text-slate-700">{user.email}</span>). Your on-device copies are kept — nothing here is deleted.
      </p>

      {result && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Imported {result.ok} design{result.ok === 1 ? "" : "s"}{result.failed ? `, ${result.failed} failed` : ""}. They’re now in your account and available on any device.
        </div>
      )}
      {err && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}

      {sources === null ? (
        <p className="inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Scanning this device…</p>
      ) : sources.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">No on-device designs found to recover.</p>
      ) : (
        <div className="space-y-6">
          {sources.map((s) => (
            <section key={s.name} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{s.label}</h2>
                  {s.ambiguous && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-amber-700">
                      <AlertTriangle size={12} /> Not tied to a specific account — import only if these are yours.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2 text-xs">
                  <button type="button" onClick={() => selectAll(s, true)} className="text-brand-600 hover:underline">Select all</button>
                  <button type="button" onClick={() => selectAll(s, false)} className="text-slate-400 hover:underline">Clear</button>
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {s.designs.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-2">
                    <input type="checkbox" checked={!!selected[d.id]} onChange={() => toggle(d.id)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{d.name}</p>
                      <p className="text-[11px] text-slate-400">{d.width}×{d.height} · {d.pageCount} page{d.pageCount === 1 ? "" : "s"} · edited {fmt(d.updatedAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => importSource(s)}
                disabled={busy}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Import selected into my account
              </button>
            </section>
          ))}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/atlas-logo.svg" alt="ATLAS Creative Hub" width={180} height={35} className="h-8 w-auto" />
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-700"><ArrowLeft size={15} /> Dashboard</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-1 flex items-center gap-2 text-xl font-bold text-slate-900"><Check size={20} className="text-brand-600" /> Recover designs from this device</h1>
        {children}
      </main>
    </div>
  );
}
