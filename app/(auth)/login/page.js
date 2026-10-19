"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

const ERRORS = {
  auth: "Sign-in link was invalid or expired. Please try again.",
  confirm: "Email confirmation failed or expired. Request a new link.",
  cloud: "Cloud is not configured on this deployment.",
};

function GoogleIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.8l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.9 36.4 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { configured, signInWithPassword, signInWithOAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [err, setErr] = useState(ERRORS[params.get("error")] || null);

  const safeNext = () => {
    const n = params.get("next");
    return n && n.startsWith("/") ? n : "/";
  };

  async function onGoogle() {
    setErr(null);
    setOauthBusy(true);
    try {
      // Redirects away to Google; no further code runs on success.
      await signInWithOAuth("google", safeNext());
    } catch (e2) {
      setErr(e2?.message || "Google sign-in failed.");
      setOauthBusy(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await signInWithPassword(email, password);
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (e2) {
      setErr(e2?.message || "Sign-in failed.");
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <p className="text-sm text-slate-600">
        Cloud sign-in is not configured for this deployment. The app runs fully on this device.
      </p>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Access your cloud designs and uploads.</p>

      <button
        type="button" onClick={onGoogle} disabled={oauthBusy || busy}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-400 disabled:opacity-60"
      >
        {oauthBusy ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </button>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        New accounts need administrator approval before cloud features unlock. You can keep working
        locally in the meantime.
      </p>

      <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email" required autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <input
          type="password" required autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="Password"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p>}
        <button
          type="submit" disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy && <Loader2 size={16} className="animate-spin" />} Sign in
        </button>
      </form>
      <div className="mt-4 flex items-center justify-between text-xs">
        <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">Forgot password?</Link>
        <Link href="/signup" className="font-medium text-brand-600 hover:underline">Create account</Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <LoginForm />
    </Suspense>
  );
}
