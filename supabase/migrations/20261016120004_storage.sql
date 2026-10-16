-- 0004 — private Storage bucket + namespaced per-user object policies
-- Private bucket: access is per-user by object key prefix {user_id}/...

insert into storage.buckets (id, name, public)
values ('designs', 'designs', false)
on conflict (id) do nothing;

create policy "designs_own_select" on storage.objects for select to authenticated
  using (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "designs_own_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "designs_own_update" on storage.objects for update to authenticated
  using  (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "designs_own_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text);
