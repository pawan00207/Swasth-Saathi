insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medical-reports', 'medical-reports', false, 20971520, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 20971520;

drop policy if exists "report files owned by user" on storage.objects;
create policy "report files owned by user" on storage.objects for all to authenticated
using (bucket_id = 'medical-reports' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'medical-reports' and (storage.foldername(name))[1] = auth.uid()::text);
