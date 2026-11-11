create extension if not exists pgcrypto with schema extensions;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category text not null default 'other',
  status text not null default 'draft' check (status in ('draft', 'published')),
  featured boolean not null default false,
  display_order integer not null default 100 check (display_order >= 0),
  project_url text,
  github_url text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.project_translations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  locale text not null check (locale in ('id', 'en')),
  title text not null default '',
  short_description text not null default '',
  description text not null default '',
  role text not null default '',
  period_label text not null default '',
  mark text not null default '',
  scope text[] not null default '{}',
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, locale)
);

create table public.project_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('cover', 'gallery')),
  alt_text_id text not null default '',
  alt_text_en text not null default '',
  caption_id text,
  caption_en text,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now()
);

create unique index project_media_one_cover_per_project
  on public.project_media(project_id) where media_type = 'cover';
create index projects_public_order_idx on public.projects(status, featured desc, display_order, created_at desc);
create index project_media_order_idx on public.project_media(project_id, media_type, display_order, created_at, id);

-- Next-sprint content tables: normalized per-record and per-locale values.
create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('work', 'organization')),
  display_order integer not null default 100 check (display_order >= 0),
  period_label text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.experience_translations (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  locale text not null check (locale in ('id', 'en')),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  unique (experience_id, locale)
);
create table public.education (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  detail_id text not null default '',
  detail_en text not null default '',
  period_label text not null default '',
  display_order integer not null default 100 check (display_order >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.site_content (
  id uuid primary key default gen_random_uuid(),
  content_key text not null,
  locale text not null check (locale in ('id', 'en')),
  value text not null default '',
  updated_at timestamptz not null default now(),
  unique (content_key, locale)
);
create table public.site_settings (
  setting_key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

create or replace function public.is_portfolio_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and is_active = true
  );
$$;
revoke all on function public.is_portfolio_admin() from public, anon;
grant execute on function public.is_portfolio_admin() to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.ensure_project_publishable()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'published' then
    if not exists (
      select 1 from public.project_translations t
      where t.project_id = new.id and t.locale = 'id'
        and length(trim(t.title)) > 0 and length(trim(t.short_description)) > 0
        and length(trim(t.description)) > 0
    ) or not exists (
      select 1 from public.project_translations t
      where t.project_id = new.id and t.locale = 'en'
        and length(trim(t.title)) > 0 and length(trim(t.short_description)) > 0
        and length(trim(t.description)) > 0
    ) then
      raise exception 'Published projects require complete Indonesian and English translations.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.save_project_bundle(p_project jsonb, p_translations jsonb, p_media jsonb)
returns uuid
language plpgsql
set search_path = pg_catalog, public, auth
as $$
declare
  v_id uuid;
  v_status text;
begin
  if not public.is_portfolio_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  v_id := nullif(p_project->>'id', '')::uuid;
  v_status := coalesce(p_project->>'status', 'draft');
  if v_status not in ('draft', 'published') then
    raise exception 'Invalid project status.' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.projects (slug, category, status, featured, display_order, project_url, github_url, start_date, end_date)
    values (p_project->>'slug', coalesce(p_project->>'category', 'other'), 'draft', coalesce((p_project->>'featured')::boolean, false), coalesce((p_project->>'display_order')::integer, 100), nullif(p_project->>'project_url', ''), nullif(p_project->>'github_url', ''), nullif(p_project->>'start_date', '')::date, nullif(p_project->>'end_date', '')::date)
    returning id into v_id;
  else
    update public.projects set slug = p_project->>'slug', category = coalesce(p_project->>'category', 'other'), featured = coalesce((p_project->>'featured')::boolean, false), display_order = coalesce((p_project->>'display_order')::integer, 100), project_url = nullif(p_project->>'project_url', ''), github_url = nullif(p_project->>'github_url', ''), start_date = nullif(p_project->>'start_date', '')::date, end_date = nullif(p_project->>'end_date', '')::date
    where id = v_id;
    if not found then raise exception 'Project not found.' using errcode = 'P0002'; end if;
  end if;

  insert into public.project_translations (project_id, locale, title, short_description, description, role, period_label, mark, scope, seo_title, seo_description)
  select v_id, x.locale, coalesce(x.title, ''), coalesce(x.short_description, ''), coalesce(x.description, ''), coalesce(x.role, ''), coalesce(x.period_label, ''), coalesce(x.mark, ''), coalesce(x.scope, '{}'), nullif(x.seo_title, ''), nullif(x.seo_description, '')
  from jsonb_to_recordset(coalesce(p_translations, '[]'::jsonb)) as x(locale text, title text, short_description text, description text, role text, period_label text, mark text, scope text[], seo_title text, seo_description text)
  on conflict (project_id, locale) do update set title = excluded.title, short_description = excluded.short_description, description = excluded.description, role = excluded.role, period_label = excluded.period_label, mark = excluded.mark, scope = excluded.scope, seo_title = excluded.seo_title, seo_description = excluded.seo_description;

  delete from public.project_media where project_id = v_id;
  insert into public.project_media (project_id, storage_path, media_type, alt_text_id, alt_text_en, caption_id, caption_en, display_order)
  select v_id, x.storage_path, x.media_type, coalesce(x.alt_text_id, ''), coalesce(x.alt_text_en, ''), x.caption_id, x.caption_en, coalesce(x.display_order, 0)
  from jsonb_to_recordset(coalesce(p_media, '[]'::jsonb)) as x(storage_path text, media_type text, alt_text_id text, alt_text_en text, caption_id text, caption_en text, display_order integer);

  update public.projects set status = v_status where id = v_id;
  return v_id;
end;
$$;

create or replace function public.save_site_content_bundle(p_settings jsonb, p_values jsonb, p_education jsonb, p_organizations jsonb)
returns void
language plpgsql
set search_path = pg_catalog, public, auth
as $$
declare
  item jsonb;
  translation jsonb;
  experience_id uuid;
begin
  if not public.is_portfolio_admin() then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  insert into public.site_settings (setting_key, value)
  select key, value from jsonb_each_text(coalesce(p_settings, '{}'::jsonb))
  on conflict (setting_key) do update set value = excluded.value, updated_at = now();
  insert into public.site_content (content_key, locale, value)
  select x.content_key, x.locale, x.value
  from jsonb_to_recordset(coalesce(p_values, '[]'::jsonb)) as x(content_key text, locale text, value text)
  on conflict (content_key, locale) do update set value = excluded.value, updated_at = now();

  delete from public.education;
  for item in select value from jsonb_array_elements(coalesce(p_education, '[]'::jsonb)) loop
    insert into public.education (title, detail_id, detail_en, period_label, display_order, is_published)
    values (coalesce(item->>'title', ''), coalesce(item->>'detail_id', ''), coalesce(item->>'detail_en', ''), coalesce(item->>'period_label', ''), coalesce((item->>'display_order')::integer, 100), coalesce((item->>'is_published')::boolean, false));
  end loop;

  delete from public.experiences where kind = 'organization';
  for item in select value from jsonb_array_elements(coalesce(p_organizations, '[]'::jsonb)) loop
    insert into public.experiences (kind, display_order, period_label, is_published)
    values ('organization', coalesce((item->>'display_order')::integer, 100), coalesce(item->>'period_label', ''), coalesce((item->>'is_published')::boolean, false)) returning id into experience_id;
    for translation in select value from jsonb_array_elements(coalesce(item->'translations', '[]'::jsonb)) loop
      insert into public.experience_translations (experience_id, locale, title, description)
      values (experience_id, translation->>'locale', coalesce(translation->>'title', ''), '');
    end loop;
  end loop;
end;
$$;

create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger project_translations_updated_at before update on public.project_translations
  for each row execute function public.set_updated_at();
create trigger projects_publish_check before insert or update of status on public.projects
  for each row execute function public.ensure_project_publishable();
revoke all on function public.save_project_bundle(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_project_bundle(jsonb, jsonb, jsonb) to authenticated;
revoke all on function public.save_site_content_bundle(jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_site_content_bundle(jsonb, jsonb, jsonb, jsonb) to authenticated;

alter table public.admin_users enable row level security;
alter table public.projects enable row level security;
alter table public.project_translations enable row level security;
alter table public.project_media enable row level security;
alter table public.experiences enable row level security;
alter table public.experience_translations enable row level security;
alter table public.education enable row level security;
alter table public.site_content enable row level security;
alter table public.site_settings enable row level security;

revoke all on table public.admin_users, public.projects, public.project_translations, public.project_media,
  public.experiences, public.experience_translations, public.education, public.site_content, public.site_settings
  from public, anon, authenticated;
grant select on public.admin_users to authenticated;
grant select on public.projects, public.project_translations, public.project_media to anon, authenticated;
grant insert, update, delete on public.projects, public.project_translations, public.project_media to authenticated;
grant select on public.experiences, public.experience_translations, public.education, public.site_content, public.site_settings to anon, authenticated;
grant insert, update, delete on public.experiences, public.experience_translations, public.education, public.site_content, public.site_settings to authenticated;

create policy admin_users_read_self on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));

create policy projects_public_read_published on public.projects
  for select to anon, authenticated using (status = 'published' or (select public.is_portfolio_admin()));
create policy projects_admin_insert on public.projects
  for insert to authenticated with check ((select public.is_portfolio_admin()));
create policy projects_admin_update on public.projects
  for update to authenticated using ((select public.is_portfolio_admin())) with check ((select public.is_portfolio_admin()));
create policy projects_admin_delete on public.projects
  for delete to authenticated using ((select public.is_portfolio_admin()));

create policy translations_public_read_published on public.project_translations
  for select to anon, authenticated using (
    exists (select 1 from public.projects p where p.id = project_id and p.status = 'published')
    or (select public.is_portfolio_admin())
  );
create policy translations_admin_insert on public.project_translations
  for insert to authenticated with check ((select public.is_portfolio_admin()));
create policy translations_admin_update on public.project_translations
  for update to authenticated using ((select public.is_portfolio_admin())) with check ((select public.is_portfolio_admin()));
create policy translations_admin_delete on public.project_translations
  for delete to authenticated using ((select public.is_portfolio_admin()));

create policy media_public_read_published on public.project_media
  for select to anon, authenticated using (
    exists (select 1 from public.projects p where p.id = project_id and p.status = 'published')
    or (select public.is_portfolio_admin())
  );
create policy media_admin_insert on public.project_media
  for insert to authenticated with check ((select public.is_portfolio_admin()));
create policy media_admin_update on public.project_media
  for update to authenticated using ((select public.is_portfolio_admin())) with check ((select public.is_portfolio_admin()));
create policy media_admin_delete on public.project_media
  for delete to authenticated using ((select public.is_portfolio_admin()));

create policy experiences_public_read_published on public.experiences
  for select to anon, authenticated using (is_published or (select public.is_portfolio_admin()));
create policy experiences_admin_insert on public.experiences for insert to authenticated with check ((select public.is_portfolio_admin()));
create policy experiences_admin_update on public.experiences for update to authenticated using ((select public.is_portfolio_admin())) with check ((select public.is_portfolio_admin()));
create policy experiences_admin_delete on public.experiences for delete to authenticated using ((select public.is_portfolio_admin()));
create policy experience_translations_read_published on public.experience_translations
  for select to anon, authenticated using (
    exists (select 1 from public.experiences e where e.id = experience_id and e.is_published)
    or (select public.is_portfolio_admin())
  );
create policy experience_translations_admin_all on public.experience_translations
  for all to authenticated using ((select public.is_portfolio_admin())) with check ((select public.is_portfolio_admin()));
create policy education_public_read_published on public.education
  for select to anon, authenticated using (is_published or (select public.is_portfolio_admin()));
create policy education_admin_all on public.education
  for all to authenticated using ((select public.is_portfolio_admin())) with check ((select public.is_portfolio_admin()));
create policy site_content_public_read on public.site_content for select to anon, authenticated using (true);
create policy site_content_admin_write on public.site_content for all to authenticated using ((select public.is_portfolio_admin())) with check ((select public.is_portfolio_admin()));
create policy site_settings_public_read on public.site_settings for select to anon, authenticated using (true);
create policy site_settings_admin_write on public.site_settings for all to authenticated using ((select public.is_portfolio_admin())) with check ((select public.is_portfolio_admin()));

-- Provision a first administrator only from the trusted SQL editor after creating the Auth user:
-- insert into public.admin_users (user_id) values ('AUTH_USER_UUID');
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio-media', 'portfolio-media', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy portfolio_media_read_published on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'portfolio-media' and exists (
      select 1 from public.project_media m
      join public.projects p on p.id = m.project_id
      where m.storage_path = name and p.status = 'published'
    )
  );
create policy portfolio_media_admin_read on storage.objects
  for select to authenticated using (bucket_id = 'portfolio-media' and (select public.is_portfolio_admin()));
create policy portfolio_media_admin_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'portfolio-media' and (select public.is_portfolio_admin())
    and (storage.foldername(name))[1] = 'projects'
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and exists (select 1 from public.projects p where p.id::text = (storage.foldername(name))[2])
  );
create policy portfolio_media_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'portfolio-media' and (select public.is_portfolio_admin()))
  with check (bucket_id = 'portfolio-media' and (select public.is_portfolio_admin()));
create policy portfolio_media_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'portfolio-media' and (select public.is_portfolio_admin()));
