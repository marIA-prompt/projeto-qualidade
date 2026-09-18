-- Bucket privado para PDFs de auditoria (FR-3).
-- Já aplicado no projeto qzmssnbrmsokppgevxrr. Idempotente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('auditorias', 'auditorias', false, 10485760, array['application/pdf']::text[])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists staff_select_auditorias on storage.objects;
drop policy if exists staff_insert_auditorias on storage.objects;
drop policy if exists staff_update_auditorias on storage.objects;
drop policy if exists staff_delete_auditorias on storage.objects;

create policy staff_select_auditorias
on storage.objects for select
to authenticated
using (bucket_id = 'auditorias' and public.eh_staff());

create policy staff_insert_auditorias
on storage.objects for insert
to authenticated
with check (bucket_id = 'auditorias' and public.eh_staff());

create policy staff_update_auditorias
on storage.objects for update
to authenticated
using (bucket_id = 'auditorias' and public.eh_staff())
with check (bucket_id = 'auditorias' and public.eh_staff());

create policy staff_delete_auditorias
on storage.objects for delete
to authenticated
using (bucket_id = 'auditorias' and public.eh_staff());
