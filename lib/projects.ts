import 'server-only'
import { projects as fallbackProjects, type Locale } from '@/content/portfolio'
import { createPublicClient } from '@/lib/supabase/public'
import { mapPublicProject, isPortfolioProjectReady, type PortfolioProject, type PublicProjectRow } from '@/lib/project-display'

type ProjectRow = PublicProjectRow

function staticFallback(): PortfolioProject[] {
  if (process.env.NODE_ENV === 'production') return []
  return fallbackProjects.map((project, index) => ({
    ...project,
    shortDescription: project.description,
    featured: index >= fallbackProjects.length - 3,
    coverAlt: `${project.title} project cover`,
    galleryItems: (project.gallery ?? []).map((url, imageIndex) => ({ url, alt: `${project.title} screenshot ${imageIndex + 1}` })),
  }))
}

async function fetchRows(slug?: string): Promise<{ rows: ProjectRow[]; supabase: NonNullable<ReturnType<typeof createPublicClient>> } | null> {
  const supabase = createPublicClient()
  if (!supabase) return null
  let query = supabase.from('projects').select('*').eq('status', 'published')
  if (slug) query = query.eq('slug', slug)
  else query = query.order('display_order', { ascending: true }).order('created_at', { ascending: false })
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
    const project = mapPublicProject(row, locale, (path) => result.supabase.storage.from('portfolio-media').getPublicUrl(path).data.publicUrl)
    return project ? [project] : []
  })
}

export async function getPortfolioProject(slug: string, locale: Locale): Promise<PortfolioProject | undefined> {
  const result = await fetchRows(slug)
  if (!result) return staticFallback().find((project) => project.slug === slug)
  const row = result.rows[0]
  return row ? mapPublicProject(row, locale, (path) => result.supabase.storage.from('portfolio-media').getPublicUrl(path).data.publicUrl) : undefined
}

export async function getPortfolioSlugs(): Promise<string[]> {
  const result = await fetchRows()
  return result ? result.rows.filter(isPortfolioProjectReady).map((row) => row.slug) : staticFallback().map((project) => project.slug)
}
