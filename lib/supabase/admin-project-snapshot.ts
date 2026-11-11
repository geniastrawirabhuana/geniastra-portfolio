import type { ProjectBundle } from './project-validation'

/** Builds the existing admin form response shape from the exact bundle saved by the RPC. */
export function adminProjectSnapshot(bundle: ProjectBundle, id: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  return {
    id,
    slug: bundle.project.slug,
    category: bundle.project.category,
    status: bundle.project.status,
    featured: bundle.project.featured,
    display_order: bundle.project.display_order,
    project_url: bundle.project.project_url ?? '',
    github_url: bundle.project.github_url ?? '',
    start_date: bundle.project.start_date ?? '',
    end_date: bundle.project.end_date ?? '',
    translations: Object.fromEntries(bundle.translations.map((translation) => [translation.locale, {
      title: translation.title,
      short_description: translation.short_description,
      description: translation.description,
      role: translation.role ?? '',
      period_label: translation.period_label ?? '',
      mark: translation.mark ?? '',
      scope: translation.scope ?? [],
      seo_title: translation.seo_title ?? '',
      seo_description: translation.seo_description ?? '',
    }])),
    media: bundle.media.map((media) => ({
      storage_path: media.storage_path,
      media_type: media.media_type,
      alt_text_id: media.alt_text_id ?? '',
      alt_text_en: media.alt_text_en ?? '',
      caption_id: media.caption_id ?? '',
      caption_en: media.caption_en ?? '',
      display_order: media.display_order ?? 0,
      ...(baseUrl ? { url: `${baseUrl}/storage/v1/object/public/portfolio-media/${media.storage_path}` } : {}),
    })),
  }
}
