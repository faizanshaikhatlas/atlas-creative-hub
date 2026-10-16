-- 0005 — least-privilege fix for the `authenticated` role.
-- This project's public-schema DEFAULT privileges had already granted
-- `authenticated` ALL on new tables (including TRUNCATE, which bypasses RLS).
-- 0003 added DML grants but did not remove that default ALL, so strip it here
-- and keep exactly the four DML privileges. Non-destructive (privileges only).
revoke all on public.projects, public.pages, public.components, public.assets from authenticated;
grant select, insert, update, delete
  on public.projects, public.pages, public.components, public.assets to authenticated;
