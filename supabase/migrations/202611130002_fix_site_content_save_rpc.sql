-- Correct the site-content bundle RPC so replace-all education deletion satisfies
-- database safeguards requiring an explicit DELETE predicate.
create or replace function public.save_site_content_bundle(p_settings jsonb, p_values jsonb, p_education jsonb, p_organizations jsonb)
returns void
language plpgsql
security invoker
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

  delete from public.education where true;
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

revoke all on function public.save_site_content_bundle(jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_site_content_bundle(jsonb, jsonb, jsonb, jsonb) to authenticated;
