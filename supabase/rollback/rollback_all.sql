-- Rollback for the ATLAS Creative Hub cloud schema (reverse of 0001-0004).
-- Cloud-only: does NOT touch Dexie/local designs. Run top-to-bottom.
-- NOTE: validate on a branch/disposable project before trusting in production.

-- 0004: storage policies + bucket
drop policy if exists "designs_own_select" on storage.objects;
drop policy if exists "designs_own_insert" on storage.objects;
drop policy if exists "designs_own_update" on storage.objects;
drop policy if exists "designs_own_delete" on storage.objects;
delete from storage.buckets where id = 'designs';

-- 0003: policies + RLS + grants
drop policy if exists "own projects"   on public.projects;
drop policy if exists "own pages"      on public.pages;
drop policy if exists "own components" on public.components;
drop policy if exists "own assets"     on public.assets;
alter table if exists public.projects   disable row level security;
alter table if exists public.pages      disable row level security;
alter table if exists public.components disable row level security;
alter table if exists public.assets     disable row level security;

-- 0002: triggers + composite FKs
drop trigger if exists projects_set_updated_at on public.projects;
drop trigger if exists pages_set_updated_at    on public.pages;
alter table if exists public.assets     drop constraint if exists assets_project_fk;
alter table if exists public.projects   drop constraint if exists projects_cover_asset_fk;
alter table if exists public.pages      drop constraint if exists pages_project_fk;
alter table if exists public.pages      drop constraint if exists pages_thumb_asset_fk;
alter table if exists public.components drop constraint if exists components_thumb_asset_fk;

-- tables (children first; cascade clears dependent objects)
drop table if exists public.pages      cascade;
drop table if exists public.components cascade;
drop table if exists public.projects   cascade;
drop table if exists public.assets     cascade;

-- extensions are left installed (harmless, shared); uncomment to fully revert:
-- drop extension if exists moddatetime;
