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

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { configured, signInWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(ERRORS[params.get("error")] || null);

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
      <form onSubmit={onSubmit} className="mt-5 space-y-3">
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
