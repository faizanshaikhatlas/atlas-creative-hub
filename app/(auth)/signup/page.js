"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Registration is INVITE-ONLY by default. Public self-registration is disabled
 * in two independent places: (1) the Supabase dashboard (`enable_signup=false`)
 * which rejects `auth.signUp` server-side, and (2) this UI, gated by
 * NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP. Flipping to public launch later (Phase E) is
 * a config change — set the env flag AND re-enable signups in the dashboard —
 * not a rebuild of the auth system. The client flag alone can NOT bypass the
 * server: even if forced true, Supabase still rejects signups while disabled.
 */
const ALLOW_PUBLIC_SIGNUP = process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP === "true";

export default function SignupPage() {
  if (!ALLOW_PUBLIC_SIGNUP) return <InviteOnlyNotice />;
  return <PublicSignupForm />;
}

function InviteOnlyNotice() {
  return (
    <div>
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-brand-600" />
        <h1 className="text-lg font-bold text-slate-900">Invitation required</h1>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        ATLAS Creative Hub is currently invite-only. If you&apos;ve been invited, open the link in your
        invitation email to activate your account.
      </p>
      <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}

function PublicSignupForm() {
  const { configured, signUpWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      // Email-only: Supabase creates the account and emails a verification link.
      // The user sets their own password after clicking it — no password here.
      // The response is uniform whether or not the email already exists, so this
      // screen never reveals which addresses are registered.
      await signUpWithEmail(email);
      setSent(true);
    } catch (e2) {
      setErr(e2?.message || "Could not send the verification link.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return <p className="text-sm text-slate-600">Cloud sign-up is not configured for this deployment.</p>;
  }
  if (sent) {
    return (
      <div className="text-center">
        <MailCheck size={30} className="mx-auto text-brand-600" />
        <h1 className="mt-3 text-lg font-bold text-slate-900">Check your email</h1>
        <p className="mt-1 text-sm text-slate-500">
          If <span className="font-medium text-slate-700">{email}</span> can be registered, a verification
          link is on its way. Open it to set your password and finish creating your account.
        </p>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-left text-xs leading-relaxed text-amber-800">
          Verifying your email is step one. An administrator then reviews and approves your account before
          cloud backup, sync, and your cloud designs unlock. You can keep designing on this device meanwhile.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-bold text-slate-900">Create account</h1>
      <p className="mt-1 text-sm text-slate-500">
        Enter your email and we&apos;ll send a verification link. You&apos;ll set your password after verifying —
        then an administrator approves your account before cloud features unlock.
      </p>
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
          {busy && <Loader2 size={16} className="animate-spin" />} Send verification link
        </button>
      </form>
      <div className="mt-4 text-center text-xs">
        <Link href="/login" className="font-medium text-brand-600 hover:underline">Already have an account? Sign in</Link>
      </div>
    </div>
  );
}
