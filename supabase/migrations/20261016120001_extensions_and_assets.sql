-- 0001 — extensions & assets
-- ATLAS Creative Hub cloud schema. See docs/supabase-architecture.md.
-- assets is created first because projects/pages/components reference it.

create extension if not exists pgcrypto    with schema extensions;  -- gen_random_uuid()
create extension if not exists moddatetime with schema extensions;  -- DB-managed updated_at

create table public.assets (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references auth.users(id) on delete cascade,
  project_id   uuid,                                  -- composite FK added in 0002 (cycle)
  storage_path text not null,                         -- '{owner}/...'  (pinned by RLS in 0003)
  mime         text,
  width        integer,
  height       integer,
  bytes        integer,
  sha256       text not null,
  created_at   timestamptz not null default now(),
  constraint assets_owner_sha_uniq unique (owner, sha256),   -- per-user dedupe
  constraint assets_id_owner_uniq  unique (id, owner)        -- composite-FK target (S1)
);
create index assets_owner_idx on public.assets (owner);
