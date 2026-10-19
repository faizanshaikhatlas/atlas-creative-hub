"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

function AcceptForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { configured, signInWithPassword } = useAuth();
  const token = params.get("token") || "";

  const [state, setState] = useState("checking"); // checking | invalid | ready | submitting | done
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState(null);

  useEffect(() => {
    let active = true;
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/invitations/validate?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!active) return;
        if (data.valid) {
          setEmail(data.email);
          setState("ready");
        } else {
          setState("invalid");
        }
      } catch {
        if (active) setState("invalid");
      }
    })();
    return () => { active = false; };
  }, [token]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) { setErr("Use at least 8 characters."); return; }
    if (password !== confirm) { setErr("Passwords do not match."); return; }
    setState("submitting");
    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error || "Could not accept the invitation.");
        setState("ready");
        return;
      }
      // Account created server-side → sign in with the invite's email.
      await signInWithPassword(data.email, password);
      setState("done");
      setTimeout(() => { router.push("/"); router.refresh(); }, 900);
    } catch (e2) {
      setErr(e2?.message || "Something went wrong.");
      setState("ready");
    }
  }

  if (!configured) {
    return <p className="text-sm text-slate-600">Cloud is not configured for this deployment.</p>;
  }
  if (state === "checking") {
    return <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Checking your invitation…</p>;
  }
  if (state === "invalid") {
    return (
      <div>
        <h1 className="text-lg font-bold text-slate-900">Invitation not valid</h1>
        <p className="mt-1 text-sm text-slate-500">
          This invitation link is invalid, expired, or already used. Ask the administrator for a new invite.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">Back to sign in</Link>
      </div>
    );
  }
  if (state === "done") {
    return <p className="text-sm text-slate-700">Account activated. Signing you in…</p>;
  }

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-900">Accept your invitation</h1>
      <p className="mt-1 text-sm text-slate-500">
        Setting up the account for <span className="font-medium text-slate-700">{email}</span>.
      </p>
      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <input
          type="password" required autoComplete="new-password" value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="Create a password (min 8 characters)"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <input
          type="password" required autoComplete="new-password" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p>}
        <button
          type="submit" disabled={state === "submitting"}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {state === "submitting" && <Loader2 size={16} className="animate-spin" />} Activate account
        </button>
      </form>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <AcceptForm />
    </Suspense>
  );
}
