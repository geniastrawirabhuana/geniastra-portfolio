import type { Locale, Project as SourceProject } from '@/content/portfolio'

export type PublicTranslationRow = {
  locale: Locale
  title: string
  short_description: string
  description: string
  role: string
  period_label: string
  mark: string
  scope: string[]
  seo_title: string | null
  seo_description: string | null
}

export type PublicMediaRow = {
  storage_path: string
  media_type: 'cover' | 'gallery'
  alt_text_id: string
  alt_text_en: string
  caption_id: string | null
  caption_en: string | null
  display_order: number
  created_at: string
}

export type PublicProjectRow = {
  id: string
  slug: string
  category: string
  status: 'draft' | 'published'
  featured: boolean
  display_order: number
  project_url: string | null
  github_url: string | null
  start_date: string | null
  end_date: string | null
  project_translations: PublicTranslationRow[]
  project_media: PublicMediaRow[]
}

type LocalizedText = { id: string; en: string }

export type PortfolioProject = Omit<SourceProject, 'description'> & {
  shortDescription: LocalizedText
  description: LocalizedText
  id?: string
  category?: string
  status?: 'draft' | 'published'
  featured: boolean
  coverAlt?: string
  galleryItems?: Array<{ url: string; alt: string; caption?: string }>
  technologies?: string[]
  projectUrl?: string
  githubUrl?: string
  seoTitle?: string
  seoDescription?: string
  displayOrder?: number
}

export function isPortfolioProjectReady(row: PublicProjectRow) {
  if (row.status !== 'published' || !row.project_media.some((item) => item.media_type === 'cover')) return false
  return (['id', 'en'] as const).every((locale) => {
    const translation = row.project_translations.find((item) => item.locale === locale)
    return Boolean(translation && [translation.title, translation.short_description, translation.description].every((field) => typeof field === 'string' && field.trim()))
  })
}

export function mapPublicProject(row: PublicProjectRow, locale: Locale, publicUrl: (path: string) => string): PortfolioProject | undefined {
  if (!isPortfolioProjectReady(row)) return undefined
  const translation = row.project_translations.find((item) => item.locale === locale)
  const cover = row.project_media.find((item) => item.media_type === 'cover')
  if (!translation || !cover) return undefined

  const media = [...row.project_media].sort((a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at) || a.storage_path.localeCompare(b.storage_path))
  const galleryItems = media.filter((item) => item.media_type === 'gallery').map((item) => ({
    url: publicUrl(item.storage_path),
    alt: locale === 'id' ? item.alt_text_id : item.alt_text_en,
    caption: (locale === 'id' ? item.caption_id : item.caption_en) || undefined,
  }))
  const localized = (key: Locale) => row.project_translations.find((item) => item.locale === key)

  return {
    id: row.id,
    slug: row.slug,
    title: translation.title,
    period: { id: localized('id')?.period_label ?? '', en: localized('en')?.period_label ?? '' },
    role: { id: localized('id')?.role ?? '', en: localized('en')?.role ?? '' },
    shortDescription: { id: localized('id')?.short_description ?? '', en: localized('en')?.short_description ?? '' },
    description: { id: localized('id')?.description ?? '', en: localized('en')?.description ?? '' },
    scope: { id: localized('id')?.scope ?? [], en: localized('en')?.scope ?? [] },
    mark: translation.mark || translation.title.slice(0, 3).toUpperCase(),
    cover: publicUrl(cover.storage_path),
    gallery: galleryItems.map((item) => item.url),
    featured: row.featured,
    category: row.category,
    status: row.status,
    displayOrder: row.display_order,
    coverAlt: locale === 'id' ? cover.alt_text_id : cover.alt_text_en,
    galleryItems,
    ...(row.project_url ? { projectUrl: row.project_url } : {}),
    ...(row.github_url ? { githubUrl: row.github_url } : {}),
    ...(translation.seo_title ? { seoTitle: translation.seo_title } : {}),
    ...(translation.seo_description ? { seoDescription: translation.seo_description } : {}),
  }
}

export function projectSeoDescription(project: PortfolioProject, locale: Locale) {
  const configured = project.seoDescription?.trim()
  if (configured) return configured

  const shortDescription = project.shortDescription?.[locale]?.trim()
  if (shortDescription) return shortDescription

  const fullDescription = project.description?.[locale]?.replace(/\s+/g, ' ').trim() ?? ''
  if (fullDescription.length <= 160) return fullDescription
  return `${fullDescription.slice(0, 157).trimEnd()}…`
}
