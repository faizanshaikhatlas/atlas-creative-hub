"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Mail, Shield, ShieldOff, Ban, Check, Copy, Trash2, RefreshCw,
  UserCheck, UserX, Clock, Search, CheckCircle2, CircleSlash,
} from "lucide-react";

/**
 * Admin panel: invite management + user management. All mutating actions call
 * admin-only server endpoints (requireAdmin on the server); this UI is a
 * convenience layer, never the authorization boundary.
 */
export default function AdminPanel({ adminEmail }) {
  const [users, setUsers] = useState(null);
  const [invites, setInvites] = useState(null);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [u, i] = await Promise.all([
        fetch("/api/admin/users").then((r) => r.json()),
        fetch("/api/admin/invitations").then((r) => r.json()),
      ]);
      if (u.error || i.error) throw new Error("You are not authorized, or a request failed.");
      setUsers(u.users);
      setInvites(i.invitations);
    } catch (e) {
      setErr(e.message || "Failed to load admin data.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-700">
              <ArrowLeft size={16} /> Dashboard
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-sm font-semibold text-slate-900">Admin</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">{adminEmail}</span>
            <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-400">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] space-y-8 px-4 py-8 sm:px-6">
        {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}

        <InviteSection invites={invites} reload={load} busyId={busyId} setBusyId={setBusyId} setErr={setErr} />
        <UserSection users={users} reload={load} busyId={busyId} setBusyId={setBusyId} setErr={setErr} adminEmail={adminEmail} />
      </main>
    </div>
  );
}

/* ------------------------------ invitations ------------------------------ */

function InviteSection({ invites, reload, busyId, setBusyId, setErr }) {
  const [email, setEmail] = useState("");
  const [days, setDays] = useState(7);
  const [creating, setCreating] = useState(false);
  const [lastInvite, setLastInvite] = useState(null); // { email, inviteUrl, expiresAt, emailSent, emailConfigured }
  const [resending, setResending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function create(e) {
    e.preventDefault();
    setErr(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, days: Number(days) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not create invitation.");
      setLastInvite({
        email: data.email,
        inviteUrl: data.inviteUrl,
        expiresAt: data.expiresAt,
        emailSent: data.emailSent,
        emailConfigured: data.emailConfigured,
      });
      setEmail("");
      reload();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setCreating(false);
    }
  }

  // Re-send the SAME invitation email, reusing the token already in this panel —
  // never mints a new invite or revokes the current one.
  async function resendEmail() {
    if (!lastInvite?.inviteUrl) return;
    setErr(null);
    setResending(true);
    try {
      const token = new URL(lastInvite.inviteUrl).searchParams.get("token") || "";
      const res = await fetch("/api/admin/invitations/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not resend the email.");
      setLastInvite((p) => ({ ...p, emailSent: data.emailSent, emailConfigured: data.emailConfigured }));
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setResending(false);
    }
  }

  async function revoke(id) {
    setErr(null);
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/invitations/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not revoke.");
      reload();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <Mail size={18} className="text-brand-600" /> Invitations
      </h2>

      <form onSubmit={create} className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500">Invitee email</span>
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-slate-500">Expires (days)</span>
          <input
            type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)}
            className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
        </label>
        <button type="submit" disabled={creating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Create invite
        </button>
      </form>

      {lastInvite && (
        <div
          className={`mb-4 rounded-xl border p-4 ${
            lastInvite.emailSent ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className={`text-sm font-semibold ${lastInvite.emailSent ? "text-emerald-800" : "text-amber-800"}`}>
              {lastInvite.emailSent
                ? "Invitation created and email sent."
                : lastInvite.emailConfigured
                ? "Invitation created, but email could not be sent. Copy the link and share it manually."
                : "Invitation created. Email sending isn't configured — copy the link and share it manually."}
            </p>
            <button
              type="button"
              onClick={() => setLastInvite(null)}
              className="shrink-0 text-slate-400 hover:text-slate-600"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>

          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-slate-600">
            <dt className="font-medium text-slate-500">Invited</dt>
            <dd className="text-slate-800">{lastInvite.email}</dd>
            <dt className="font-medium text-slate-500">Expires</dt>
            <dd className="text-slate-800">{fmt(lastInvite.expiresAt)}</dd>
          </dl>

          <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">{lastInvite.inviteUrl}</span>
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(lastInvite.inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy link"}
            </button>
          </div>

          {lastInvite.emailConfigured && (
            <button
              type="button"
              onClick={resendEmail}
              disabled={resending}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {resending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} Resend email
            </button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {invites === null ? (
          <Loading />
        ) : invites.length === 0 ? (
          <Empty text="No invitations yet." />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="px-4 py-2">Email</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Expires</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody>
              {invites.map((inv) => {
                const status = inviteStatus(inv);
                return (
                  <tr key={inv.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5 text-slate-700">{inv.email}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={status} /></td>
                    <td className="px-4 py-2.5 text-slate-500">{fmt(inv.expires_at)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {status === "pending" && (
                        <button onClick={() => revoke(inv.id)} disabled={busyId === inv.id}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                          {busyId === inv.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/* --------------------------------- users --------------------------------- */

function UserSection({ users, reload, busyId, setBusyId, setErr, adminEmail }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // all | pending | approved | rejected | disabled
  const [notice, setNotice] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null); // { id, email, counts }

  // Reject = permanent hard-delete of the Auth account + profile (frees the email
  // to register again). The server refuses with 409 when the user owns cloud rows
  // unless we pass confirmDeleteData; we surface a confirmation for that case.
  async function removeUser(u, confirmData = false) {
    setErr(null);
    setNotice(null);
    setBusyId(u.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: u.id, confirmDeleteData: confirmData }),
      });
      const data = await res.json();
      if (res.status === 409 && data?.needsDataConfirm) {
        setPendingDelete({ id: u.id, email: u.email, counts: data.counts });
        return;
      }
      if (!res.ok) throw new Error(data?.error || "Could not delete the account.");
      setPendingDelete(null);
      setNotice(`Deleted ${u.email}. That email can register again now.`);
      reload();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusyId(null);
    }
  }

  async function patch(id, patchBody) {
    setErr(null);
    setNotice(null);
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...patchBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not update user.");
      if (data.approvedNow) {
        const u = (users || []).find((x) => x.id === id);
        const who = u?.email ? ` to ${u.email}` : "";
        setNotice(
          data.setupEmailSent
            ? `Approved. A password-setup / sign-in link was emailed${who}.`
            : `Approved. No setup email was sent${who} (OAuth user, email not configured, or send failed) — they can sign in or use “Forgot password”.`
        );
      }
      reload();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusyId(null);
    }
  }

  const all = users || [];
  const pendingCount = all.filter((u) => effStatus(u) === "pending").length;
  const needle = q.trim().toLowerCase();
  const list = all.filter((u) => {
    if (filter !== "all" && effStatus(u) !== filter) return false;
    if (needle && !`${u.email || ""} ${u.provider || ""}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  const FILTERS = [
    ["all", "All"],
    ["pending", `Pending${pendingCount ? ` (${pendingCount})` : ""}`],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
    ["disabled", "Disabled"],
  ];

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <Shield size={18} className="text-brand-600" /> Users &amp; approvals
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            <Clock size={12} /> {pendingCount} pending
          </span>
        )}
      </h2>

      {notice && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 text-emerald-600 hover:text-emerald-800">✕</button>
        </div>
      )}

      {pendingDelete && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="font-semibold">Permanently delete {pendingDelete.email}?</p>
          <p className="mt-1 text-[13px] leading-relaxed">
            This permanently removes the account, its profile, and all of their data —{" "}
            {pendingDelete.counts.projects} design{pendingDelete.counts.projects === 1 ? "" : "s"}
            {pendingDelete.counts.components ? `, ${pendingDelete.counts.components} component${pendingDelete.counts.components === 1 ? "" : "s"}` : ""}
            {pendingDelete.counts.storageFiles ? `, ${pendingDelete.counts.storageFiles} stored file${pendingDelete.counts.storageFiles === 1 ? "" : "s"}` : ""}
            {" "}— from the database and Supabase Storage. This cannot be undone. Their local designs on their
            own device are not affected, and the email can register again afterward.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              disabled={busyId === pendingDelete.id}
              onClick={() => removeUser({ id: pendingDelete.id, email: pendingDelete.email }, true)}
              className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              {busyId === pendingDelete.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete permanently
            </button>
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or method…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                filter === val ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-brand-400"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {users === null ? (
          <Loading />
        ) : list.length === 0 ? (
          <Empty text={all.length === 0 ? "No users yet." : "No users match this filter."} />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2">Requested</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const self = adminEmail && u.email === adminEmail;
                const eff = effStatus(u);
                const isAdmin = u.role === "admin";
                return (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0 align-middle">
                    <td className="px-4 py-2.5 text-slate-700">
                      {u.email}{self && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">you</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 capitalize">{u.provider || "email"}</td>
                    <td className="px-4 py-2.5 text-slate-500">{fmt(u.requested_at || u.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isAdmin ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"}`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-2.5"><UserStatusBadge status={eff} /></td>
                    <td className="px-4 py-2.5">
                      {self ? (
                        <p className="text-right text-[11px] text-slate-400">—</p>
                      ) : isAdmin ? (
                        /* Admins: governed by role + disable; never Reject/delete (demote first). */
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <ActionBtn busy={busyId === u.id} onClick={() => patch(u.id, { role: "user" })} icon={<ShieldOff size={13} />} label="Remove admin" />
                          {u.disabled ? (
                            <ActionBtn busy={busyId === u.id} onClick={() => patch(u.id, { disabled: false })} icon={<Check size={13} />} label="Enable" />
                          ) : (
                            <ActionBtn busy={busyId === u.id} danger onClick={() => patch(u.id, { disabled: true })} icon={<Ban size={13} />} label="Disable" />
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {/* Disabled: kept account — only Enable to restore access. */}
                          {eff === "disabled" && (
                            <ActionBtn busy={busyId === u.id} onClick={() => patch(u.id, { disabled: false })} icon={<Check size={13} />} label="Enable" />
                          )}
                          {/* Pending: Approve or Reject (delete). */}
                          {eff === "pending" && (
                            <>
                              <ActionBtn busy={busyId === u.id} onClick={() => patch(u.id, { status: "approved" })} icon={<UserCheck size={13} />} label="Approve" good />
                              <ActionBtn busy={busyId === u.id} danger onClick={() => removeUser(u)} icon={<UserX size={13} />} label="Reject" />
                            </>
                          )}
                          {/* Approved: Make admin, Disable, or Reject (delete). */}
                          {eff === "approved" && (
                            <>
                              <ActionBtn busy={busyId === u.id} onClick={() => patch(u.id, { role: "admin" })} icon={<Shield size={13} />} label="Make admin" />
                              <ActionBtn busy={busyId === u.id} danger onClick={() => patch(u.id, { disabled: true })} icon={<Ban size={13} />} label="Disable" />
                              <ActionBtn busy={busyId === u.id} danger onClick={() => removeUser(u)} icon={<Trash2 size={13} />} label="Reject" />
                            </>
                          )}
                          {/* Legacy 'rejected' rows (no new ones are created): allow cleanup. */}
                          {eff === "rejected" && (
                            <>
                              <ActionBtn busy={busyId === u.id} onClick={() => patch(u.id, { status: "approved" })} icon={<UserCheck size={13} />} label="Approve" good />
                              <ActionBtn busy={busyId === u.id} danger onClick={() => removeUser(u)} icon={<Trash2 size={13} />} label="Delete" />
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        You can&apos;t change your own account. <strong>Reject</strong> permanently deletes the account and
        its cloud data so the email can register again; <strong>Disable</strong> keeps the account and
        revokes cloud access until you <strong>Enable</strong> it. Approvals and bans are enforced
        server-side. A user&apos;s local on-device designs are never affected.
      </p>
    </section>
  );
}

/** Effective display status: a disabled account shows as "disabled" regardless of approval. */
function effStatus(u) {
  return u.disabled ? "disabled" : u.status || "pending";
}

function UserStatusBadge({ status }) {
  const map = {
    pending: ["bg-amber-100 text-amber-700", <Clock key="i" size={11} />],
    approved: ["bg-emerald-100 text-emerald-700", <CheckCircle2 key="i" size={11} />],
    rejected: ["bg-slate-200 text-slate-600", <CircleSlash key="i" size={11} />],
    disabled: ["bg-rose-100 text-rose-700", <Ban key="i" size={11} />],
  };
  const [cls, icon] = map[status] || map.pending;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{icon}{status}</span>;
}

/* -------------------------------- helpers -------------------------------- */

function ActionBtn({ onClick, busy, icon, label, danger, good }) {
  const tone = good
    ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
    : danger
    ? "border-rose-200 text-rose-600 hover:bg-rose-50"
    : "border-slate-200 text-slate-600 hover:bg-slate-50";
  return (
    <button onClick={onClick} disabled={busy}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50 ${tone}`}>
      {busy ? <Loader2 size={13} className="animate-spin" /> : icon} {label}
    </button>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: "bg-amber-100 text-amber-700",
    accepted: "bg-emerald-100 text-emerald-700",
    revoked: "bg-slate-200 text-slate-600",
    expired: "bg-rose-100 text-rose-700",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>{status}</span>;
}

function inviteStatus(inv) {
  if (inv.accepted_at) return "accepted";
  if (inv.revoked_at) return "revoked";
  if (new Date(inv.expires_at).getTime() < Date.now()) return "expired";
  return "pending";
}

function fmt(ts) {
  try { return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
  catch { return ""; }
}

function Loading() {
  return <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
}
function Empty({ text }) {
  return <div className="px-4 py-8 text-center text-sm text-slate-400">{text}</div>;
}
