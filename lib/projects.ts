import 'server-only'
import { projects as fallbackProjects, type Locale, type Project as SourceProject } from '@/content/portfolio'
import { createPublicClient } from '@/lib/supabase/public'
import type { Database } from '@/lib/supabase/database.types'

export type PortfolioProject = SourceProject & {
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

type ProjectRow = Database['public']['Tables']['projects']['Row'] & { project_translations: TranslationRow[]; project_media: MediaRow[] }
type TranslationRow = { locale: Locale; title: string; short_description: string; description: string; role: string; period_label: string; mark: string; scope: string[]; seo_title: string | null; seo_description: string | null }
type MediaRow = { storage_path: string; media_type: 'cover' | 'gallery'; alt_text_id: string; alt_text_en: string; caption_id: string | null; caption_en: string | null; display_order: number; created_at: string }

function staticFallback(): PortfolioProject[] {
  if (process.env.NODE_ENV === 'production') return []
  return fallbackProjects.map((project, index) => ({
    ...project,
    featured: index >= fallbackProjects.length - 3,
    coverAlt: `${project.title} project cover`,
    galleryItems: (project.gallery ?? []).map((url, imageIndex) => ({ url, alt: `${project.title} screenshot ${imageIndex + 1}` })),
  }))
}

function mapProject(row: ProjectRow, locale: Locale, supabase: NonNullable<ReturnType<typeof createPublicClient>>): PortfolioProject | undefined {
  const translation = row.project_translations.find((item) => item.locale === locale)
  if (!translation) return undefined
  const media = [...row.project_media].sort((a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at) || a.storage_path.localeCompare(b.storage_path))
  const cover = media.find((item) => item.media_type === 'cover')
  const gallery = media.filter((item) => item.media_type === 'gallery').map((item) => ({
    url: supabase.storage.from('portfolio-media').getPublicUrl(item.storage_path).data.publicUrl,
    alt: locale === 'id' ? item.alt_text_id : item.alt_text_en,
    caption: (locale === 'id' ? item.caption_id : item.caption_en) || undefined,
  }))
  const url = (item?: MediaRow) => item ? supabase.storage.from('portfolio-media').getPublicUrl(item.storage_path).data.publicUrl : undefined
  const localized = (key: 'id' | 'en') => row.project_translations.find((item) => item.locale === key)
  return {
    id: row.id, slug: row.slug, title: translation.title,
    period: { id: localized('id')?.period_label ?? '', en: localized('en')?.period_label ?? '' },
    role: { id: localized('id')?.role ?? '', en: localized('en')?.role ?? '' },
    description: { id: localized('id')?.short_description ?? '', en: localized('en')?.short_description ?? '' },
    scope: { id: localized('id')?.scope ?? [], en: localized('en')?.scope ?? [] },
    mark: translation.mark || translation.title.slice(0, 3).toUpperCase(),
    ...(url(cover) ? { cover: url(cover) } : {}), gallery: gallery.map((item) => item.url),
    featured: row.featured, category: row.category, status: row.status, displayOrder: row.display_order,
    coverAlt: cover ? (locale === 'id' ? cover.alt_text_id : cover.alt_text_en) : `${translation.title} project cover`,
    galleryItems: gallery, ...(row.project_url ? { projectUrl: row.project_url } : {}), ...(row.github_url ? { githubUrl: row.github_url } : {}),
    ...(translation.seo_title ? { seoTitle: translation.seo_title } : {}), ...(translation.seo_description ? { seoDescription: translation.seo_description } : {}),
  }
}

async function fetchRows(slug?: string): Promise<{ rows: ProjectRow[]; supabase: NonNullable<ReturnType<typeof createPublicClient>> } | null> {
  const supabase = createPublicClient()
  if (!supabase) return null
  let query = supabase.from('projects').select('*').eq('status', 'published')
  if (slug) query = query.eq('slug', slug)
  else query = query.order('featured', { ascending: false }).order('display_order', { ascending: true }).order('created_at', { ascending: false })
  const { data, error } = await query
  if (error) throw new Error(`Unable to load published projects: ${error.message}`)
  const projects = data ?? []
  const ids = projects.map((project) => project.id)
  if (!ids.length) return { rows: [], supabase }
  const [{ data: translations, error: translationsError }, { data: media, error: mediaError }] = await Promise.all([
    supabase.from('project_translations').select('*').in('project_id', ids),
    supabase.from('project_media').select('*').in('project_id', ids).order('project_id').order('media_type').order('display_order').order('created_at').order('id'),
  ])
  if (translationsError || mediaError) throw new Error(`Unable to load project details: ${translationsError?.message ?? mediaError?.message}`)
  return { rows: projects.map((project) => ({ ...project, project_translations: (translations ?? []).filter((item) => item.project_id === project.id), project_media: (media ?? []).filter((item) => item.project_id === project.id) })) as ProjectRow[], supabase }
}

export async function getPortfolioProjects(locale: Locale): Promise<PortfolioProject[]> {
  const result = await fetchRows()
  if (!result) return staticFallback()
  return result.rows.flatMap((row) => {
    const project = mapProject(row, locale, result.supabase)
    return project ? [project] : []
  })
}

export async function getPortfolioProject(slug: string, locale: Locale): Promise<PortfolioProject | undefined> {
  const result = await fetchRows(slug)
  if (!result) return staticFallback().find((project) => project.slug === slug)
  const row = result.rows[0]
  return row ? mapProject(row, locale, result.supabase) : undefined
}

export async function getPortfolioSlugs(): Promise<string[]> {
  const result = await fetchRows()
  return result ? result.rows.map((row) => row.slug) : staticFallback().map((project) => project.slug)
}
