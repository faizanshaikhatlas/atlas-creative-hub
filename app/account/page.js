import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";
import { getSessionProfile } from "@/lib/auth/roles";

// Authenticated-only account route. Server-gated (defense-in-depth with the
// middleware redirect). Signed-out visitors go to /login?next=/account.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?next=/account");

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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <dl className="space-y-4">
            <Row label="Email" value={profile.email} />
            <Row
              label="Role"
              value={
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${profile.role === "admin" ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"}`}>
                  {profile.role}
                </span>
              }
            />
            <Row
              label="Access"
              value={
                profile.disabled
                  ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">disabled</span>
                  : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">active</span>
              }
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

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}
