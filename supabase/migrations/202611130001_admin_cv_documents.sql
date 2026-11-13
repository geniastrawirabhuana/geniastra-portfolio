-- Public CV documents are isolated from portfolio-media.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-documents', 'public-documents', true, 5242880, array['application/pdf'])
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists public_documents_contact_read on storage.objects;
create policy public_documents_contact_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'public-documents' and (storage.foldername(name))[1] = 'contact');

drop policy if exists public_documents_contact_admin_insert on storage.objects;
create policy public_documents_contact_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'public-documents'
    and name ~ '^contact/cv-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$'
    and (select public.is_portfolio_admin())
  );

drop policy if exists public_documents_contact_admin_update on storage.objects;
create policy public_documents_contact_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'public-documents'
    and name ~ '^contact/cv-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$'
    and (select public.is_portfolio_admin())
  )
  with check (
    bucket_id = 'public-documents'
    and name ~ '^contact/cv-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$'
    and (select public.is_portfolio_admin())
  );

drop policy if exists public_documents_contact_admin_delete on storage.objects;
create policy public_documents_contact_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'public-documents'
    and name ~ '^contact/cv-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$'
    and (select public.is_portfolio_admin())
  );
