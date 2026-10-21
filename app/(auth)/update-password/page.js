"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Set a password for an authenticated session. Reached from two email links,
 * both of which route through /auth/callback and establish a session first:
 *   - password RESET (forgot-password)         → recovery session
 *   - email-only SIGNUP (?setup=1)              → verified new-account session
 *
 * A session is required to succeed. After setting the password we consult the
 * authoritative /api/me: an already-active user goes home; a still-pending user
 * (the normal signup case) sees the "awaiting approval" message — setting a
 * password is NOT approval, and this page never changes approval status.
 */
function UpdatePasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setup = params.get("setup") === "1"; // came from email-only signup
  const { configured, loading, user, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [outcome, setOutcome] = useState(null); // "home" | "pending"

  // Give the auth provider a moment to pick up the session, then warn if the
  // user arrived without one (e.g. opened the link directly / it expired).
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
      // Approval is separate from verification: only send an already-approved
      // user into the app; a pending user stays gated and is told so.
      let active = false;
      try {
        const r = await fetch("/api/me");
        const d = await r.json();
        active = d?.active === true;
      } catch {
        active = false;
      }
      if (active) {
        setOutcome("home");
        setTimeout(() => { router.push("/"); router.refresh(); }, 1200);
      } else {
        setOutcome("pending");
      }
    } catch (e2) {
      setErr(e2?.message || "Could not set the password.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return <p className="text-sm text-slate-600">This flow is not configured for this deployment.</p>;
  }

  if (checked && !user) {
    return (
      <div>
        <h1 className="text-lg font-bold text-slate-900">
          {setup ? "Verification link needed" : "Reset link needed"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {setup
            ? "Open the verification link from your email to set your password."
            : "Open the password-reset link from your email to set a new password."}
        </p>
        <Link href={setup ? "/signup" : "/forgot-password"} className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
          {setup ? "Back to sign up" : "Request a reset link"}
        </Link>
      </div>
    );
  }

  if (outcome === "pending") {
    return (
      <div className="text-center">
        <ShieldCheck size={30} className="mx-auto text-brand-600" />
        <h1 className="mt-3 text-lg font-bold text-slate-900">Email verified</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your password is set. Your account is awaiting administrator approval before cloud backup, sync,
          and your cloud designs unlock.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link href="/" className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
            Continue to ATLAS
          </Link>
          <Link href="/login" className="text-sm font-medium text-brand-600 hover:underline">Back to sign in</Link>
        </div>
      </div>
    );
  }

  if (outcome === "home") {
    return (
      <div className="text-center">
        <MailCheck size={30} className="mx-auto text-brand-600" />
        <p className="mt-3 text-sm text-slate-700">Password set. Redirecting…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-900">
        {setup ? "Create your password" : "Set a new password"}
      </h1>
      {setup && (
        <p className="mt-1 text-sm text-slate-500">
          Your email is verified. Choose a password to finish creating your account.
        </p>
      )}
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
          {busy && <Loader2 size={16} className="animate-spin" />} {setup ? "Create password" : "Update password"}
        </button>
      </form>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <UpdatePasswordForm />
    </Suspense>
  );
}
