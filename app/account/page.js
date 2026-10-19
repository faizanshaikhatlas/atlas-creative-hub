import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Shield, Clock } from "lucide-react";
import { getSessionProfile, isActiveMember } from "@/lib/auth/roles";

// Authenticated-only account route. Server-gated (defense-in-depth with the
// middleware redirect). Signed-out visitors go to /login?next=/account.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?next=/account");

  const active = isActiveMember(profile);
  const statusLabel = profile.disabled ? "disabled" : profile.status || "pending";

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-[800px] items-center gap-3">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-700">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-sm font-semibold text-slate-900">Account</h1>
        </div>
      </header>

      <main className="mx-auto max-w-[800px] px-4 py-8 sm:px-6">
        {!active && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <Clock size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">
                {statusLabel === "rejected" ? "Access not granted" : statusLabel === "disabled" ? "Account disabled" : "Awaiting approval"}
              </p>
              <p className="mt-1 text-amber-700">
                {statusLabel === "rejected" || statusLabel === "disabled"
                  ? "Your account can’t use cloud features. Your local designs on this device are unaffected."
                  : "An administrator needs to approve your account before cloud backup, sync, and your cloud designs unlock. You can keep working locally in the meantime."}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <dl className="space-y-4">
            <Row label="Email" value={profile.email} />
            <Row label="Sign-in method" value={<span className="capitalize">{profile.provider || "email"}</span>} />
            <Row
              label="Role"
              value={
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${profile.role === "admin" ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"}`}>
                  {profile.role}
                </span>
              }
            />
            <Row
              label="Status"
              value={<StatusBadge status={statusLabel} />}
            />
          </dl>

          <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
            {profile.role === "admin" && (
              <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 hover:border-brand-400">
                <Shield size={15} /> Admin panel
              </Link>
            )}
            {/* Server POST sign-out clears the session cookies and redirects to /login. */}
            <form action="/auth/signout" method="post">
              <button type="submit" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-rose-600">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-slate-200 text-slate-600",
    disabled: "bg-rose-100 text-rose-700",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] || map.pending}`}>{status}</span>;
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}
