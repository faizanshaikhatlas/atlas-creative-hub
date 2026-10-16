"use client";

import { useState } from "react";
import { Cloud, CloudOff, Loader2, LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { syncPushAll, syncPull } from "@/lib/sync/sync";

/**
 * Optional cloud controls for the home header. Renders nothing when Supabase is
 * not configured, so the local-first app is visually unchanged by default.
 * When signed in, "Sync now" pushes all local designs then pulls remote ones.
 */
export default function CloudMenu({ onSynced }) {
  const { configured, loading, user, signInWithPassword, signInWithMagicLink, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  if (!configured) return null;
  if (loading) {
    return <Loader2 size={18} className="animate-spin text-slate-400" />;
  }

  async function handleSignIn(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await signInWithPassword(email, password);
      setOpen(false);
      setPassword("");
    } catch (err) {
      setMsg(err?.message || "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMagicLink() {
    if (!email) {
      setMsg("Enter your email first.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await signInWithMagicLink(email);
      setMsg("Check your email for a sign-in link.");
    } catch (err) {
      setMsg(err?.message || "Could not send magic link.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    setBusy(true);
    setMsg(null);
    try {
      const push = await syncPushAll(user.id);
      const pull = await syncPull(user.id);
      const conflicts = [...new Set([...(push.conflicts || []), ...(pull.conflicts || [])])];
      setMsg(
        `Synced. Pushed ${push.pushed}, pulled ${pull.pulled}` +
          (conflicts.length ? ` · ${conflicts.length} conflict(s) need review` : "")
      );
      onSynced?.();
    } catch (err) {
      setMsg(err?.message || "Sync failed.");
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-slate-500 sm:inline">{user.email}</span>
          <button
            type="button"
            onClick={handleSync}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-brand-400 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Sync now
          </button>
          <button
            type="button"
            onClick={signOut}
            title="Sign out"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition hover:text-rose-600"
          >
            <LogOut size={14} />
          </button>
        </div>
        {msg && <span className="text-[11px] text-slate-500">{msg}</span>}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-brand-400"
      >
        {open ? <CloudOff size={14} /> : <Cloud size={14} />}
        Sign in to sync
      </button>
      {open && (
        <form
          onSubmit={handleSignIn}
          className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mb-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="mb-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "…" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={busy}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-400 disabled:opacity-60"
            >
              Magic link
            </button>
          </div>
          {msg && <p className="mt-2 text-[11px] text-slate-500">{msg}</p>}
        </form>
      )}
    </div>
  );
}
