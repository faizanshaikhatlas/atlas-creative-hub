-- 0006 — invite-only onboarding: invitations table (service-role ONLY)
-- Additive and non-destructive: creates one new table + indexes. No existing
-- table, row, policy, or grant is modified.
--
-- Access model: RLS is enabled with NO policies for anon/authenticated, and all
-- grants are revoked from them, so neither role can read or modify invitations
-- through the Data API. Only service_role (BYPASSRLS, used server-side via the
-- accept endpoint / admin CLI) can touch this table. This satisfies "invitation
-- records cannot be manipulated by normal users."

create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  token_hash  text not null unique,                 -- SHA-256 of the random token; raw token is never stored
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,                 -- enforced server-side on accept
  accepted_at timestamptz,                           -- set once; single-use
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at  timestamptz
);

create index if not exists invitations_email_idx
  on public.invitations (lower(email));
create index if not exists invitations_active_idx
  on public.invitations (expires_at)
  where accepted_at is null and revoked_at is null;

alter table public.invitations enable row level security;

-- This project's public-schema default privileges auto-grant anon/authenticated,
-- so lock them out explicitly (defense-in-depth on top of RLS-with-no-policies).
revoke all on public.invitations from anon, authenticated;
-- service_role keeps its default ALL (+ BYPASSRLS); used server-side only.
