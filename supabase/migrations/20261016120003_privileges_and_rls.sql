-- 0003 — privileges + RLS + policies
-- This project's public-schema default privileges auto-grant anon/authenticated
-- ALL table privileges, so lock anon out explicitly and narrow authenticated.

revoke all on public.projects, public.pages, public.components, public.assets from anon;
grant select, insert, update, delete
  on public.projects, public.pages, public.components, public.assets to authenticated;
-- service_role keeps its default ALL (+ BYPASSRLS); used server-side only.

alter table public.projects   enable row level security;
alter table public.pages      enable row level security;
alter table public.components enable row level security;
alter table public.assets     enable row level security;

-- Policies scoped `to authenticated` so they never apply to anon (defense-in-depth
-- on top of the REVOKE); service_role bypasses RLS regardless.
create policy "own projects" on public.projects
  for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

create policy "own pages" on public.pages            -- direct owner check (denormalized owner)
  for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

create policy "own components" on public.components
  for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

-- assets: own rows AND storage_path pinned to the caller's own prefix (S7)
create policy "own assets" on public.assets
  for all to authenticated using (owner = auth.uid())
  with check (owner = auth.uid()
              and storage_path like (auth.uid()::text || '/%'));
