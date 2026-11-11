export type AdminLocale = 'id' | 'en'
export type AdminTranslation = {
  title: string
  short_description: string
  description: string
  role: string
  period_label: string
  mark: string
  scope: string[]
  seo_title: string
  seo_description: string
}
export type AdminMedia = {
  storage_path: string
  media_type: 'cover' | 'gallery'
  alt_text_id: string
  alt_text_en: string
  caption_id: string
  caption_en: string
  display_order: number
  url?: string
}
export type AdminProject = {
  id?: string
  slug: string
  category: string
  status: 'draft' | 'published'
  featured: boolean
  display_order: number
  project_url: string
  github_url: string
  start_date: string
  end_date: string
  translations: Record<AdminLocale, AdminTranslation>
  media: AdminMedia[]
}

const emptyTranslation = (): AdminTranslation => ({ title: '', short_description: '', description: '', role: '', period_label: '', mark: '', scope: [], seo_title: '', seo_description: '' })

export const emptyAdminProject = (): AdminProject => ({ slug: '', category: 'website', status: 'draft', featured: false, display_order: 100, project_url: '', github_url: '', start_date: '', end_date: '', translations: { id: emptyTranslation(), en: emptyTranslation() }, media: [] })

type NullableProjectInput = Partial<Omit<AdminProject, 'translations' | 'media'>> & {
  translations?: Partial<Record<AdminLocale, Partial<AdminTranslation> | null>> | null
  media?: Array<(Partial<AdminMedia> & { media_type?: AdminMedia['media_type'] | null }) | null> | null
}

const text = (value: unknown) => typeof value === 'string' ? value : ''

/** Converts database/API nulls and missing localized rows into editable form values. */
export function normalizeAdminProject(value: NullableProjectInput | null | undefined): AdminProject {
  const project = value ?? {}
  const normalizeTranslation = (locale: AdminLocale): AdminTranslation => {
    const translation = project.translations?.[locale] ?? {}
    return {
      title: text(translation.title),
      short_description: text(translation.short_description),
      description: text(translation.description),
      role: text(translation.role),
      period_label: text(translation.period_label),
      mark: text(translation.mark),
      scope: Array.isArray(translation.scope) ? translation.scope.filter((line): line is string => typeof line === 'string') : [],
      seo_title: text(translation.seo_title),
      seo_description: text(translation.seo_description),
    }
  }

  return {
    ...(typeof project.id === 'string' ? { id: project.id } : {}),
    slug: text(project.slug),
    category: text(project.category) || 'other',
    status: project.status === 'published' ? 'published' : 'draft',
    featured: project.featured === true,
    display_order: typeof project.display_order === 'number' ? project.display_order : 100,
    project_url: text(project.project_url),
    github_url: text(project.github_url),
    start_date: text(project.start_date),
    end_date: text(project.end_date),
    translations: { id: normalizeTranslation('id'), en: normalizeTranslation('en') },
    media: Array.isArray(project.media) ? project.media.flatMap((item): AdminMedia[] => {
      if (!item || (item.media_type !== 'cover' && item.media_type !== 'gallery')) return []
      return [{
        storage_path: text(item.storage_path),
        media_type: item.media_type,
        alt_text_id: text(item.alt_text_id),
        alt_text_en: text(item.alt_text_en),
        caption_id: text(item.caption_id),
        caption_en: text(item.caption_en),
        display_order: typeof item.display_order === 'number' ? item.display_order : 0,
        ...(typeof item.url === 'string' ? { url: item.url } : {}),
      }]
    }) : [],
  }
}
