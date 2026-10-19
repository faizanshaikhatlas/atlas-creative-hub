"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Loader2, UserRound, Shield } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Compact header account control. Renders NOTHING when cloud is not configured,
 * so the local-first app is visually unchanged by default. When configured it
 * offers sign-in (logged out) or the account email + sign-out (logged in).
 *
 * Phase 1 does not gate any route — this is just the entry point to the auth
 * flows. Route protection arrives in Phase 4.
 */
export default function AccountMenu() {
  const router = useRouter();
  const { configured, loading, user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Resolve admin status from the authoritative server endpoint (never inferred
  // on the client). Only used to decide whether to show the Admin link; the
  // /admin route is itself server-gated.
  useEffect(() => {
    let active = true;
    if (!user) { setIsAdmin(false); return; }
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => { if (active) setIsAdmin(d?.role === "admin" && !d?.disabled); })
      .catch(() => { if (active) setIsAdmin(false); });
    return () => { active = false; };
  }, [user]);

  if (!configured) return null;
  if (loading) return <Loader2 size={16} className="animate-spin text-slate-400" />;

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-400"
      >
        <LogIn size={15} /> Sign in
      </Link>
    );
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {isAdmin && (
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 transition hover:border-brand-400"
        >
          <Shield size={15} /> Admin
        </Link>
      )}
      <Link href="/account" className="hidden items-center gap-1.5 text-xs text-slate-500 transition hover:text-brand-700 sm:inline-flex" title="Account">
        <UserRound size={14} /> {user.email}
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={busy}
        title="Sign out"
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-rose-600 disabled:opacity-60"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </div>
  );
}
