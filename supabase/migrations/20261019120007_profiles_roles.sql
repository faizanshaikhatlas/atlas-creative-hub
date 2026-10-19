-- 0007 — profiles + roles (admin/user). Additive and non-destructive.
-- Role is SERVER-CONTROLLED: users may READ only their own profile and have NO
-- write policy, so they cannot change their own role or disabled flag (no
-- self-promotion). All role/disable writes go through service-role admin
-- endpoints. service_role bypasses RLS. No existing table/row is modified;
-- existing users are backfilled as regular 'user' (never auto-admin).

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'user' check (role in ('user','admin')),
  disabled   boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Default privileges auto-grant authenticated; strip to least privilege (read only).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
-- Intentionally NO insert/update/delete policies for authenticated.

-- Auto-provision a profile for every new auth user (role defaults to 'user').
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing users (explicit; no auto-admin).
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;
