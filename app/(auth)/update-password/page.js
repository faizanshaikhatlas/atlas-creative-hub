"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Set a new password. Reached from the password-reset email, which routes
 * through /auth/callback and establishes a temporary recovery session before
 * landing here. Requires an authenticated (recovery) session to succeed.
 */
export default function UpdatePasswordPage() {
  const router = useRouter();
  const { configured, loading, user, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(false);

  // Give the auth provider a moment to pick up the recovery session, then warn
  // if the user arrived here without one (e.g. opened the link directly).
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!loading) setChecked(true);
  }, [loading]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) {
      setErr("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => { router.push("/"); router.refresh(); }, 1200);
    } catch (e2) {
      setErr(e2?.message || "Could not update the password.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return <p className="text-sm text-slate-600">Password reset is not configured for this deployment.</p>;
  }

  if (checked && !user) {
    return (
      <div>
        <h1 className="text-lg font-bold text-slate-900">Reset link needed</h1>
        <p className="mt-1 text-sm text-slate-500">
          Open the password-reset link from your email to set a new password.
        </p>
        <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
          Request a reset link
        </Link>
      </div>
    );
  }

  if (done) {
    return <p className="text-sm text-slate-700">Password updated. Redirecting…</p>;
  }

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-900">Set a new password</h1>
      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <input
          type="password" required autoComplete="new-password" value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="New password (min 8 characters)"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <input
          type="password" required autoComplete="new-password" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p>}
        <button
          type="submit" disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy && <Loader2 size={16} className="animate-spin" />} Update password
        </button>
      </form>
    </div>
  );
}
