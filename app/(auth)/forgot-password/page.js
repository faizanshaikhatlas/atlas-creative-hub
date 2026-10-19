"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

export default function ForgotPasswordPage() {
  const { configured, resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await resetPasswordForEmail(email);
      setSent(true);
    } catch (e2) {
      setErr(e2?.message || "Could not send the reset email.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return <p className="text-sm text-slate-600">Password reset is not configured for this deployment.</p>;
  }

  if (sent) {
    return (
      <div className="text-center">
        <MailCheck size={30} className="mx-auto text-brand-600" />
        <h1 className="mt-3 text-lg font-bold text-slate-900">Check your email</h1>
        <p className="mt-1 text-sm text-slate-500">
          If an account exists for <span className="font-medium text-slate-700">{email}</span>, a password-reset
          link is on its way. Open it to set a new password.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-900">Reset password</h1>
      <p className="mt-1 text-sm text-slate-500">We&apos;ll email you a secure link to set a new password.</p>
      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <input
          type="email" required autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p>}
        <button
          type="submit" disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy && <Loader2 size={16} className="animate-spin" />} Send reset link
        </button>
      </form>
      <div className="mt-4 text-center text-xs">
        <Link href="/login" className="font-medium text-brand-600 hover:underline">Back to sign in</Link>
      </div>
    </div>
  );
}
