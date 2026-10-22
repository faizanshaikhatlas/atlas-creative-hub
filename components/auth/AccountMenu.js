"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Loader2, UserRound, Shield, Clock } from "lucide-react";
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
  const [me, setMe] = useState(null);
  const [pending, setPending] = useState(0);

  // Resolve role/approval from the authoritative server endpoint (never inferred
  // on the client). Used only for display (Admin link, pending pill); the /admin
  // route and all cloud data are gated server-side / by RLS regardless.
  useEffect(() => {
    let active = true;
    if (!user) { setIsAdmin(false); setMe(null); return; }
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (active) { setIsAdmin(d?.role === "admin" && !d?.disabled); setMe(d); } })
      .catch(() => { if (active) { setIsAdmin(false); setMe(null); } });
    return () => { active = false; };
  }, [user]);

  const showPending = me && me.active === false; // authenticated but not yet an active member

  // Admin notification: count of accounts awaiting approval (count only; no
  // private data). Fetched only for admins; the endpoint is admin-gated too.
  useEffect(() => {
    if (!isAdmin) { setPending(0); return; }
    let active = true;
    fetch("/api/admin/pending-count")
      .then((r) => (r.ok ? r.json() : { pending: 0 }))
      .then((d) => { if (active) setPending(d?.pending || 0); })
      .catch(() => { if (active) setPending(0); });
    return () => { active = false; };
  }, [isAdmin]);

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
      {showPending && (
        <Link
          href="/account"
          title={me?.status === "rejected" || me?.disabled ? "Access not granted" : "Awaiting admin approval"}
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition hover:border-amber-300"
        >
          <Clock size={15} /> <span className="hidden sm:inline">{me?.status === "rejected" || me?.disabled ? "No access" : "Pending"}</span>
        </Link>
      )}
      {isAdmin && (
        <Link
          href="/admin"
          aria-label="Admin"
          title={pending > 0 ? `${pending} account(s) awaiting approval` : "Admin"}
          className="relative inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 transition hover:border-brand-400"
        >
          <Shield size={15} /> <span className="hidden sm:inline">Admin</span>
          {pending > 0 && (
            <span className="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {pending > 99 ? "99+" : pending}
            </span>
          )}
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
