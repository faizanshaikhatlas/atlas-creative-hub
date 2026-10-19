# Approval notifications

ATLAS Creative Hub is local-first with Supabase as the only backend, and Supabase sends
**authentication** emails only (confirmation, recovery, invites) — there is no general-purpose
mail service in the app. Given that architecture, approval notifications are delivered the
safest practical way: **in-app, admin-only, aggregate signals**, with an optional documented
upgrade to email.

## Implemented now — in-app admin signals

1. **Header badge (any admin, any page with the header).** `components/auth/AccountMenu.js`
   fetches `GET /api/admin/pending-count` when the signed-in user is an admin and shows an
   amber count badge on the **Admin** link. The endpoint is gated by `requireAdmin()` and
   returns **only an integer** — no emails, no per-user data — so nothing private is exposed
   (non-admins get `403`).
2. **Dashboard list + badge.** `/admin` → **Users & approvals** shows a "N pending" badge, a
   **Pending** filter, and the full request rows (email, sign-in method, request date, status)
   with Approve / Reject / Disable actions. This is the authoritative place to act.

This satisfies "display pending requests to the owner/admin" and "do not expose private user
data to other users": only admins can see any of it, and the ambient signal is a count.

## Optional upgrade — email digest (no new always-on backend)

If you later want an email when someone requests access, the safe, self-contained option is a
**Supabase Edge Function** triggered on new `pending` profiles, sending through a transactional
provider (Resend/Postmark/SES). Outline:

1. Add the provider's API key as an **Edge Function secret** (server-side only; never a
   `NEXT_PUBLIC_*` var, never committed).
2. Deploy an Edge Function `notify-admins` that, given a new pending user, emails the
   owner/admin address(es) a message containing **only** the new user's email + "awaiting
   approval" and a link to `/admin` — no other users' data.
3. Trigger it with a Postgres `after insert` trigger on `public.profiles` that fires on
   `status='pending'`, calling the function via `pg_net`/`supabase_functions.http_request`, or
   with a scheduled (cron) Edge Function that emails a once-a-day digest of pending counts.

Why this shape:

- The service key / provider key stay server-side in Supabase, consistent with the project rule
  never to expose the service-role key or ship secrets.
- The email contains only what the admin already sees in `/admin`; it never broadcasts one
  user's data to another user.
- It's additive and optional — the app works fully without it via the in-app badge.

> Not recommended: emailing from the browser/client, embedding provider keys in the app, or
> notifying anyone other than admins. All three would leak secrets or private data.
