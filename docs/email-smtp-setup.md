# Email (custom SMTP) — configuration guide (owner performs)

Decision: send auth emails from **faizan.shaikh@atlasuniversity.edu.in** via **Supabase custom SMTP**.
Supabase then sends confirmation, recovery, and invite emails from your address — **no app code**, and
the `EMAIL_APP_PASSWORD` you already have is used **here (in the Supabase dashboard), not in the Next.js
app**. (The Next.js `.env.local` cannot change Supabase's email sender.)

> Nothing in the repo reads `EMAIL_APP_PASSWORD` today. Under this route it does not need to — it is
> entered into the Supabase dashboard SMTP form. Keep it out of any `NEXT_PUBLIC_*` variable.

## 1. Get SMTP settings for your mailbox

Your address is on a Google Workspace domain (`atlasuniversity.edu.in`), so SMTP is Gmail's:

- Host: `smtp.gmail.com`
- Port: `465` (SSL) or `587` (STARTTLS)
- Username: `faizan.shaikh@atlasuniversity.edu.in`
- Password: the **App Password** (16-char) you generated — requires 2-Step Verification on the account.
  (If your Workspace admin blocks App Passwords, use a transactional provider instead — see §4.)
- Sender name: e.g. `ATLAS Creative Hub`

## 2. Configure Supabase

**Dashboard → Project → Authentication → Emails → SMTP Settings → Enable Custom SMTP:**
- Sender email: `faizan.shaikh@atlasuniversity.edu.in`
- Sender name: `ATLAS Creative Hub`
- Host / Port / Username: from §1
- Password: your App Password
- Save.

**Authentication → URL Configuration** (confirm these exist for the links to resolve):
- Site URL: your prod URL (locally `http://localhost:3000`)
- Redirect URLs: `…/auth/callback`, `…/auth/confirm` (local + prod)

**Authentication → Providers → Email:** keep **Confirm email ON** (so step 2 of your flow — the
verification email — actually sends).

## 3. Verify (no app change)

- Trigger a password reset from `/forgot-password` (or a new signup) and confirm the email **arrives from
  your address**. Check Supabase **Auth → Logs** if it doesn't.
- Gmail App-Password SMTP has low daily send limits (hundreds/day) — fine for invite/approval volumes,
  not for bulk. For higher volume use §4.

## 4. Alternative (if Gmail App Password is blocked or you outgrow limits)

Use a transactional provider (Resend / Postmark / SES): verify the `atlasuniversity.edu.in` domain
(SPF/DKIM), then put that provider's SMTP host/user/pass into the same Supabase Custom SMTP form. Same
result, higher deliverability/limits.

## What this unblocks

Once custom SMTP is live, the email-dependent phases can be implemented and actually tested:
- **P4** — on admin approval, send the user a secure **password-setup / sign-in link** (via Supabase
  `generateLink` + SMTP, or `inviteUserByEmail`), so they finish setup and log in.
- Registration verification and password recovery already work through Supabase; after this they come
  from your address.
