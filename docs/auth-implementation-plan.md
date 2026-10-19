# ATLAS Creative Hub — Authentication & Access-Control Implementation Plan

_Audited 2026-10-19. This document tracks a phased rollout of secure auth on top of
the existing local-first (Dexie) + optional Supabase architecture. It is a planning
artifact only — no secrets, no credentials._

## 1. What already exists and works

**App (local-first, no auth required today):**
- Next.js 16 App Router, JavaScript only, Tailwind v4. Routes: `/` (dashboard),
  `/editor/[id]`, `/templates`, `/cloud-selftest`.
- Dexie/IndexedDB is the authoritative store for designs, pages, uploads, Brand Kits,
  and a sync outbox (`lib/db/*`). The editor, dashboard, and exports all run fully
  offline/local with no sign-in.

**Supabase backend (already provisioned, project ref `baswqkhufaoshsxbicct`):**
- Tables `public.projects`, `public.pages`, `public.components`, `public.assets`, each
  with a denormalized `owner uuid → auth.users(id)` and composite `(id, owner)` FKs so a
  row can only reference another row owned by the same user. `updated_at` triggers present.
  (1 project + 1 page row currently exist; preserved.)
- **RLS is already strong** (migrations `0003`/`0005`):
  - `anon` revoked from all four tables; `authenticated` granted only SELECT/INSERT/UPDATE/DELETE
    (no TRUNCATE, which would bypass RLS).
  - Policies scoped `to authenticated`: `using (owner = auth.uid()) with check (owner = auth.uid())`.
  - `assets` additionally pins `storage_path` to the caller's own `auth.uid()/` prefix.
- **Private Storage** bucket `designs` (not public). Per-user object policies keyed on the
  first path segment = `auth.uid()` (migration `0004`).
- Client plumbing: a browser-only Supabase client (`lib/supabase/client.js`), an
  `AuthProvider` context (password / magic-link / signup / signout), an orphaned `CloudMenu`
  (not mounted in the running app), and an optional, conflict-aware, non-destructive
  Dexie⇄cloud sync layer (`lib/sync/*`).

## 2. What is missing (relative to the requested access model)

1. **Server-verifiable sessions.** The current client stores the session in the browser
   (localStorage), so no server route, Server Component, or Route Handler can verify who the
   caller is. There is no `middleware`, no server client, and (until this phase) no
   `@supabase/ssr`.
2. **Auth UI/routes.** No login / signup / password-reset pages; no email-confirmation or
   recovery callback route. `CloudMenu` exists but is a popover and is not mounted.
3. **Invite-only onboarding** (Phase 2): no invitations table, no server-validated acceptance,
   `enable_signup` is currently open.
4. **Roles / admin** (Phase 3): no `profiles`/roles source of truth, no admin, no initial-owner
   procedure.
5. **Route & API protection** (Phase 4): editor/dashboard are open; nothing enforces access.
6. **Guest mode formalization** (Phase 6): the app is effectively "guest = local Dexie" today,
   but there is no explicit, consent-based import of local designs into an account.

## 3. Security risks / uncertainties

- **Remote dashboard auth settings are not readable via MCP.** `supabase/config.toml` configures
  *local* dev only. The remote project's `enable_signup`, email-confirmation, redirect allow-list,
  and leaked-password protection must be verified/changed in the Supabase dashboard by the owner.
  (Advisor currently reports leaked-password protection **disabled** — WARN.)
- **Two session systems risk.** Introducing server sessions must not create a second, conflicting
  client. Resolution: unify on one **cookie-based** session via `@supabase/ssr` (`createBrowserClient`
  + `createServerClient`), replacing the localStorage client in place. Existing localStorage sessions
  (if any) will require one re-login — non-destructive (no design data lost).
- **Do not trust the client.** Email/authorization flags from the browser must never be trusted;
  invite and role checks (Phases 2–3) must be validated server-side with `auth.uid()` / privileged
  server operations only.

## 4. Files likely to change (whole program, by phase)

- **Phase 1 (this phase):** `package.json` (add `@supabase/ssr`), `lib/supabase/client.js` (→ cookie
  browser client), `lib/supabase/server.js` (new), `lib/supabase/middleware.js` (new), `middleware.js`
  (new), `app/auth/callback/route.js` + `app/auth/confirm/route.js` + `app/auth/signout/route.js` (new),
  `app/(auth)/layout.js` + `login` + `signup` + `forgot-password` + `update-password` (new),
  `components/auth/AuthProvider.js` (extend), `components/auth/AccountMenu.js` (new), `app/page.js`
  (mount AccountMenu).
- **Phase 2:** `invitations` table migration, server actions/route handlers for create/accept,
  signup gating, admin invite UI.
- **Phase 3:** `profiles`/roles migration, custom-claims or server role checks, initial-owner script.
- **Phase 4:** middleware/route-guards for `/editor`, dashboard, account; server-side authorization
  in any data-access path.
- **Phase 5:** reviewed additive migrations if any policy gaps are found (current RLS looks sound).
- **Phase 6:** explicit local→cloud import flow with consent + conflict handling.

## 5. How existing data is preserved

- No destructive migrations, no DB reset, no record deletion. The 1 existing project/page row and
  all Dexie data (designs, uploads, Brand Kits, sync queue) are untouched.
- Supabase schema changes in later phases will be **additive** migrations only.
- Switching the browser client to cookie storage changes *where the session token lives*, not any
  user data.

## 6. Manual configuration required (Supabase dashboard — owner performs)

- Populate `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (owner
  already has these; never commit them). Without them the app stays local-only and auth UI is hidden.
- **Auth → URL Configuration:** set Site URL and add redirect URLs for `…/auth/callback` and
  `…/auth/confirm` (local: `http://localhost:3000/...`).
- **Auth → Providers → Email:** decide whether "Confirm email" is on (Phase 1 handles both).
- **Auth → Password security:** enable leaked-password protection (addresses the advisor WARN).
- `enable_signup` stays open for Phase 1 testing; **Phase 2 will require turning public signups off**.

## 7. Phases (status)

- [x] **Audit + plan** — this document.
- [x] **Phase 1 — Authentication foundation** (code complete; build passes; needs owner's dashboard
  config + browser verification): cookie-based App Router sessions
  (`@supabase/ssr`), server client + session-refresh middleware, login/signup/logout/password-reset
  flows, email-confirmation & recovery callback routes, branded auth pages, header account control.
  Routes are **not** force-gated yet (that is Phase 4).
- [x] **Phase 2 — Invite-only registration** (code complete; migration applied; needs owner's
  dashboard config + service-role env + browser verification): `invitations` table (service-role
  only), atomic single-use/expiring token accept flow, public signup disabled (dashboard +
  `NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP` flag), admin CLI to mint invites, courtesy rate limiting.
- [x] **Phase 3 — Admin & role management** (code complete; migration applied; needs owner to run
  make-admin + browser verification): server-controlled `profiles.role` (admin/user) with RLS
  (read-own-only, no client writes), auto-provision trigger + backfill (no auto-admin), explicit
  initial-owner CLI (`scripts/make-admin.mjs`), admin-only endpoints (invite create/list/revoke,
  user list/role/disable) each gated by server `requireAdmin()`, server-gated `/admin` panel, and
  an Admin link shown only to admins (via authoritative `/api/me`). Disabling bans the user in
  Supabase Auth; guards prevent self-modification and removing the last admin.
- [x] **Phase 4 — Protect routes & APIs** (code complete; build passes; needs browser verification):
  middleware gates `/admin` + `/account` (redirect anon → `/login?next=…`, preserving session
  cookies); new server-gated `/account` page; editor/dashboard stay public to preserve guest mode
  (opt-in full lockdown via `NEXT_PUBLIC_REQUIRE_AUTH`); API handlers already enforce authorization
  (requireAdmin/token/self); cloud data enforced by RLS (`owner = auth.uid()`), verified anon reads
  return nothing. Disabled users lose cloud + admin access automatically (ban + RLS + requireAdmin).
- [x] **Phase 5 — DB & Storage security review** (complete; one additive hardening migration applied):
  verified RLS ownership on every table + storage, least-privilege grants, private bucket, and
  service-role-only invitations. Fixed advisors 0028/0029 by revoking EXECUTE on the SECURITY
  DEFINER `handle_new_user` (migration 0008). Remaining advisor items are intentional (invitations
  deny-all = INFO) or dashboard (leaked-password protection = manual). Brand Kits are local-only
  (no cloud table); designs → projects/pages (owner-scoped); uploads → assets + private storage
  (owner-scoped).
- [x] **Phase 6 — Guest mode & existing-design preservation** (code complete; build passes; needs
  signed-in browser verification): guest mode kept (local-first Dexie; guests get no session so RLS
  + revoked anon grants block all cloud access); added a deliberate, consent-based `CloudSync`
  control (signed-in only, self-hides for guests) that pushes local designs to the user's own
  account (owner-stamped) and pulls cloud designs — never automatic, never deletes local, conflicts
  reported not overwritten (existing conflict-aware sync layer). Brand Kits remain local-only.
## 8. Access-control workflow v2 — approval + Google OAuth (new workstream, 2026-10-19)

Product decisions (confirmed by owner): **approval-gate model** — signups ENABLED at GoTrue,
but ALL access gated on `status='approved'` (new accounts start `pending`); **invited users are
auto-approved** on accept; **Google OAuth** added, but OAuth login never auto-grants access
(new OAuth users land `pending`). This intentionally REVERSES the earlier "disable public signups"
item (gate moves from signup-time to approval-time). Owner promotion of
`faizan.shaikh@…` is pending the owner's explicit go / self-run.

- [x] **v2-P1 — Approval data model** (additive migration `0009`): `profiles.status`
  (pending/approved/rejected), `provider`, `approved_at`, `approved_by`, `requested_at`;
  existing users backfilled `approved` (access preserved); trigger stamps provider + `pending`
  for new accounts; `handle_new_user` RPC revoke re-asserted. No RLS/enforcement change yet.
- [x] **v2-P2 — Server + DB enforcement** (migration `0010`; build passes; RLS proven): added
  `is_active_member()` (SECURITY **INVOKER** — reads only the caller's own profile, no new RPC
  privilege) and appended `AND public.is_active_member()` to all four owner-scoped table policies
  (preserving the assets storage-path pin) and all four private-storage policies — additive
  strengthening, nothing loosened. Added `requireApproved()` + `isActiveMember()` in
  `lib/auth/roles.js`, surfaced authoritative `status`/`active` via `/api/me`, and gated `CloudSync`
  (hides the sync action + shows an "awaiting approval/disabled" notice for non-active users).
  Verified by impersonation (JWT-claim, rolled back): approved → sees own data; pending → blocked
  (0 rows); stranger → blocked. Disable path uses the same `not disabled` predicate plus the Auth
  ban, so access ends on the next request. No data changed (rollback confirmed).
- [x] **v2-P3 — Admin approval dashboard** (build passes; anon gating re-verified): `/api/admin/users`
  GET now returns `status`/`provider`/`requested_at`/`approved_at`; PATCH accepts `status`
  (approved/rejected/pending) and stamps `approved_at`+`approved_by` server-side (cleared when not
  approved), reusing the self-modify + last-admin guards and `requireAdmin()`. The `/admin` "Users &
  approvals" section now shows email, sign-in method, request date, role, and status
  (Pending/Approved/Rejected/Disabled) with Approve/Reject/Disable/Enable + role actions, a pending
  count badge, search, and status filters. Admins are governed by role+disable (no Approve/Reject on
  them); you can't act on your own row. Anon PATCH `{status}` → 403, `/admin` → 307 (confirmed live).
- [x] **v2-P4 — Google OAuth** (build passes; login renders button): `signInWithOAuth('google', next)`
  added to AuthProvider (returns to the existing `/auth/callback` PKCE route; validated same-origin
  next); "Continue with Google" button + approval note on `/login`; `AccountMenu` shows a Pending/No-access
  pill and `/account` shows Status + Sign-in method + a pending/rejected/disabled notice. New Google
  users land `provider='google'`, `status='pending'` (0009 trigger) → gated by RLS + requireApproved
  until an admin approves. Config documented in `docs/google-oauth-setup.md` (Google Cloud OAuth
  client, Supabase provider + redirect allow-list, signups-ON for the approval-gate model, browser
  verification). MANUAL: owner must enable the Google provider in Supabase (until then the button
  errors) and add redirect URLs.
- [x] **v2-P5 — Approval notifications** (build passes; anon gating verified): admin-only
  `GET /api/admin/pending-count` (returns only an integer — no private data; `requireAdmin`),
  surfaced as an amber count badge on the header **Admin** link (fetched only for admins) in
  addition to the existing `/admin` pending badge + filter. No app mail backend exists, so the safe
  practical mechanism is these in-app admin-only signals; the email-digest upgrade (Supabase Edge
  Function + transactional provider, keys server-side only, admins-only, data-minimal) is documented
  in `docs/approval-notifications.md`. Verified: anon → 403; current pending count = 0.
- [x] **v2-P6 — Verification & integration** (complete): build ✓; advisors clean (only invitations
  deny-all INFO + leaked-password WARN); anon matrix — guest routes 200, `/admin`+`/account` 307,
  all admin APIs (users GET/PATCH-status, invitations GET/POST, pending-count) 403, `/api/me`
  `{authenticated:false}`, validate no-token `{valid:false}`; anon Data API denied (42501) with zero
  anon grants; `designs` bucket private; all 4 table + 4 storage policies carry the membership gate.
  Gate logic proven for every state (rolled back): user pending/rejected=blocked, approved=allowed,
  approved+disabled=blocked; admin default/rejected=allowed (role override), admin+disabled=blocked.
  Session revocation confirmed LIVE on the owner-disabled `tech@` account (is_active_member=false,
  0 rows) — RLS denies on next request; disable also applies the Supabase Auth ban (session dies on
  refresh). Note: live data reflects the owner's own dashboard testing (a 3rd approved account; tech@
  rejected+disabled) — left untouched. MANUAL remaining: enable Google provider + redirect URLs;
  leaked-password protection; confirm signups ON (approval-gate); Vercel prod env parity.

---

- [x] **Phase 7 — Security verification & final integration** (complete; build passes; empirical
  checks run against the running app + remote DB): verified RLS/grants (anon has no table grants;
  owner-scoped ALL with using+check on projects/pages/components/assets; profiles SELECT-only =
  no self-promotion; invitations deny-all/service-role only), private storage bucket with per-user
  folder policies, live route gating (`/admin` + `/account` → 307 for anon; `/` + `/login` → 200),
  live API authz (`/api/admin/*` → 403 for anon; `/api/me` → `{authenticated:false}`, no leak;
  validate GET-only, no token-existence leak), anon Data API denied (42501) on all tables,
  `handle_new_user` no longer RPC-exposed, and no secrets tracked by git (only `.env.example`;
  service role never NEXT_PUBLIC). Invite-only onboarding proven by real data (the invited account
  was created via single-use token accept). TWO owner actions remain outstanding and block go-live:
  (1) remote `disable_signup` is still **false** — public signups open at the GoTrue level until the
  dashboard toggle is turned off; (2) no account has `role='admin'` yet (run `scripts/make-admin.mjs`).
  Dashboard leaked-password protection (WARN) also still pending.
