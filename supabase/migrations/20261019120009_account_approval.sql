-- 0009 — account approval model (ADDITIVE, non-destructive).
--
-- Adds a server-controlled approval workflow ON TOP of the existing role system:
--   status: 'pending' | 'approved' | 'rejected'   (new accounts start 'pending')
--   provider: sign-in method ('email', 'google', ...) stamped at provisioning
--   approved_at / approved_by: audit trail for who granted access and when
--   requested_at: when the account first appeared (for the admin request list)
--
-- This migration ONLY adds columns, backfills existing users as 'approved', and
-- teaches the signup trigger to record provider + 'pending'. It does NOT change
-- any RLS/grants or gate access yet (that is the next, separate phase), so no
-- current behavior changes and every existing user keeps full access.
--
-- 'disabled' (existing boolean, mirrored by a Supabase Auth ban) is kept ORTHOGONAL
-- to status: a disabled account is blocked regardless of status. The admin UI will
-- surface "Disabled" as a distinct state.
--
-- Role remains the server-controlled source of truth with NO user write policy, so
-- these new columns are likewise read-own-only and NEVER user-writable (no
-- self-approval). All approval writes go through the service-role admin endpoints.

alter table public.profiles
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  add column if not exists provider text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists requested_at timestamptz not null default now();

-- Preserve access for everyone who already exists: all pre-existing profiles
-- (the owner + any current users) become 'approved'. New rows created AFTER this
-- migration keep the 'pending' default. Runs once, at migration time.
update public.profiles
set status = 'approved',
    approved_at = coalesce(approved_at, created_at, now())
where status = 'pending';

-- Backfill the sign-in method from auth for existing users.
update public.profiles p
set provider = coalesce(p.provider, u.raw_app_meta_data ->> 'provider', 'email')
from auth.users u
where u.id = p.id;

-- Teach the auto-provision trigger to record the provider and start new accounts
-- as 'pending'. (CREATE OR REPLACE preserves the function's existing privileges.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, provider, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Re-assert the 0008 hardening: the SECURITY DEFINER function must not be callable
-- as an RPC by anon/authenticated (defense-in-depth; it only runs as the trigger).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
