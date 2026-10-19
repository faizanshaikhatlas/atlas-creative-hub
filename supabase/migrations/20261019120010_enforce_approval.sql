-- 0010 — enforce approval at the database + storage layer (STRENGTHENS RLS).
--
-- Adds an active-membership gate to every owner-scoped policy so that ONLY an
-- approved (or admin), non-disabled account can read/write cloud data, even if it
-- owns the rows. This is additive strengthening — the existing owner / storage-path
-- clauses are preserved exactly and nothing is loosened.
--
-- is_active_member() is SECURITY INVOKER: it runs as the calling user and reads
-- ONLY that user's own profile row (permitted by the existing "read own profile"
-- RLS), so it grants no elevated privilege and leaks nothing about other accounts.
-- Pending / rejected / disabled users therefore lose access to projects, pages,
-- components, assets, and private storage automatically — on the very next request,
-- without waiting for a token to expire.

create or replace function public.is_active_member()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and not disabled
      and (role = 'admin' or status = 'approved')
  );
$$;

-- ---- owner-scoped data tables: append AND is_active_member() ----

drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects for all to authenticated
  using (owner = auth.uid() and public.is_active_member())
  with check (owner = auth.uid() and public.is_active_member());

drop policy if exists "own pages" on public.pages;
create policy "own pages" on public.pages for all to authenticated
  using (owner = auth.uid() and public.is_active_member())
  with check (owner = auth.uid() and public.is_active_member());

drop policy if exists "own components" on public.components;
create policy "own components" on public.components for all to authenticated
  using (owner = auth.uid() and public.is_active_member())
  with check (owner = auth.uid() and public.is_active_member());

-- assets: preserve the storage_path prefix pin in with_check.
drop policy if exists "own assets" on public.assets;
create policy "own assets" on public.assets for all to authenticated
  using (owner = auth.uid() and public.is_active_member())
  with check (
    owner = auth.uid()
    and storage_path like ((auth.uid())::text || '/%')
    and public.is_active_member()
  );

-- ---- private storage bucket: append AND is_active_member() ----

drop policy if exists "designs_own_select" on storage.objects;
create policy "designs_own_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] = (auth.uid())::text
    and public.is_active_member()
  );

drop policy if exists "designs_own_insert" on storage.objects;
create policy "designs_own_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] = (auth.uid())::text
    and public.is_active_member()
  );

drop policy if exists "designs_own_update" on storage.objects;
create policy "designs_own_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] = (auth.uid())::text
    and public.is_active_member()
  )
  with check (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] = (auth.uid())::text
    and public.is_active_member()
  );

drop policy if exists "designs_own_delete" on storage.objects;
create policy "designs_own_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] = (auth.uid())::text
    and public.is_active_member()
  );
