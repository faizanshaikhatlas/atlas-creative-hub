# Google sign-in — configuration guide (owner performs)

ATLAS Creative Hub supports Google sign-in through **Supabase Auth**. The app code is
already wired (a "Continue with Google" button on `/login`, using Supabase's
`signInWithOAuth`, returning to the existing `/auth/callback` PKCE route). What remains is
**dashboard/provider configuration**, which only the project owner can do — no code change
and no secrets committed to the repo.

> **Security model (already enforced):** a successful Google login does **not** grant app
> access. A new Google user is auto-provisioned in `public.profiles` with
> `provider='google'` and `status='pending'`, and every protected resource (cloud designs,
> uploads, private storage, sync) is gated by RLS + server checks on
> *approved + not-disabled* membership. New Google users therefore land in **Pending** and
> must be approved by an admin in `/admin` before anything cloud unlocks. Existing approved
> users sign in normally.

---

## 1. Google Cloud — create an OAuth client

1. Go to **Google Cloud Console → APIs & Services → OAuth consent screen**.
   - User type: **External** (or Internal if you restrict to your Google Workspace).
   - Fill app name, support email, and developer contact. Add your domain under
     *Authorized domains* (e.g. `atlasuniversity.edu.in` and `supabase.co`).
   - Add the scopes `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`.
   - While testing with *External + Testing*, add each tester's Google address under
     **Test users** (or publish the app to allow anyone).
2. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized JavaScript origins:**
     - `http://localhost:3000` (local dev)
     - your production origin, e.g. `https://<your-domain>`
   - **Authorized redirect URIs** — this must be the **Supabase callback**, not the app:
     - `https://baswqkhufaoshsxbicct.supabase.co/auth/v1/callback`
3. Copy the generated **Client ID** and **Client secret** (used only in the Supabase
   dashboard below — never put them in the repo or in `NEXT_PUBLIC_*`).

## 2. Supabase — enable the Google provider

1. **Dashboard → Authentication → Providers → Google → Enable.**
2. Paste the **Client ID** and **Client secret** from step 1. Save.
3. **Authentication → URL Configuration:**
   - **Site URL:** `http://localhost:3000` locally; your production URL in prod.
   - **Redirect URLs (allow-list)** — add the app callback the browser returns to after
     Supabase finishes the exchange:
     - `http://localhost:3000/auth/callback`
     - `https://<your-domain>/auth/callback`
   - (The email flows already use `/auth/callback` and `/auth/confirm`; keep those too.)

## 3. Signups must be ENABLED for the approval-gate model

Because access is controlled by **approval** (not by blocking account creation), new Google
users need to be able to create an account and then wait in **Pending**:

- **Authentication → Sign In / Providers →** ensure **"Allow new users to sign up"** is **ON**.
- This intentionally differs from the earlier invite-only "signups off" guidance. Safety is
  preserved because an account with no approval can access nothing (RLS + server checks). If
  you ever want to *also* restrict who can even create an account, keep signups on and rely on
  the approval gate, or switch to the invite-only variant (keep signups off — then Google
  login only succeeds for users you pre-provision).

## 4. Verify (browser)

1. Open `/login` → **Continue with Google** → pick a Google account.
2. You return to the app signed in, but the header shows a **Pending** pill and
   **Cloud → "Awaiting approval"**; `/account` shows **Status: pending**, **Method: google**.
3. In the DB (or `/admin` as an admin), the new row appears with `provider='google'`,
   `status='pending'`.
4. As an admin, open `/admin` → **Users & approvals** → **Approve** that user.
5. Sign in again as that user → cloud backup/sync now works; their designs sync under their
   own `owner = auth.uid()` (RLS-isolated).

## Notes

- **No app env var is required for Google** — Supabase holds the client secret. The app only
  calls `supabase.auth.signInWithOAuth({ provider: 'google' })`.
- The same `/auth/callback` route handles the OAuth `?code=` exchange and the email-link
  flows; `next` is validated to be a same-origin relative path (no open redirects).
- Disabling or rejecting a Google user takes effect on their next request (RLS membership
  check) and, for disable, bans the Auth session on refresh — same as email users.
