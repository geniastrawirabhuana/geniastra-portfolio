import type { Database, Json } from './database.types'

type Translation = Database['public']['Tables']['project_translations']['Insert']
type Media = Database['public']['Tables']['project_media']['Insert']
type Project = Database['public']['Tables']['projects']['Insert'] & { status: 'draft' | 'published' }
export type ProjectBundle = { project: Project; translations: Translation[]; media: Media[] }

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
function string(value: unknown, max: number) { return typeof value === 'string' ? value.trim().slice(0, max) : '' }
function optionalUrl(value: unknown) {
  const candidate = string(value, 1000)
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null
  } catch { return null }
}
function validDate(value: unknown) {
  const candidate = string(value, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) && !Number.isNaN(Date.parse(`${candidate}T00:00:00Z`)) ? candidate : null
}

export function normalizeProjectBundle(value: unknown): ProjectBundle | undefined {
  if (!value || typeof value !== 'object') return undefined
  const input = value as Record<string, unknown>
  const slug = string(input.slug, 96).toLowerCase()
  const status = input.status === 'published' ? 'published' : input.status === 'draft' || input.status === undefined ? 'draft' : null
  const category = string(input.category, 40).toLowerCase()
  if (!slugPattern.test(slug) || !status || !['website', 'web-application', 'chatbot', 'other'].includes(category)) return undefined
  const translationsInput = input.translations && typeof input.translations === 'object' ? input.translations as Record<string, unknown> : {}
  const mediaInput = Array.isArray(input.media) ? input.media : []
  const translations: Translation[] = (['id', 'en'] as const).map((locale) => {
    const row = translationsInput[locale] && typeof translationsInput[locale] === 'object' ? translationsInput[locale] as Record<string, unknown> : {}
    const scopes = Array.isArray(row.scope) ? row.scope.map((entry) => string(entry, 180)).filter(Boolean).slice(0, 30) : []
    return {
      project_id: typeof input.id === 'string' ? input.id : '', locale,
      title: string(row.title, 180), short_description: string(row.short_description, 500), description: string(row.description, 5000),
      role: string(row.role, 120), period_label: string(row.period_label, 100), mark: string(row.mark, 12), scope: scopes,
      seo_title: string(row.seo_title, 180) || null, seo_description: string(row.seo_description, 500) || null,
    }
  })
  const media: Media[] = mediaInput.slice(0, 13).flatMap((raw): Media[] => {
    if (!raw || typeof raw !== 'object') return []
    const row = raw as Record<string, unknown>
    const storagePath = string(row.storage_path, 500)
    const mediaType = row.media_type === 'cover' || row.media_type === 'gallery' ? row.media_type : null
    if (!storagePath || !mediaType || !/^projects\/[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}\/[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}\.(?:jpg|png|webp|avif)$/i.test(storagePath)) return []
    return [{ project_id: typeof input.id === 'string' ? input.id : '', storage_path: storagePath, media_type: mediaType, alt_text_id: string(row.alt_text_id, 300), alt_text_en: string(row.alt_text_en, 300), caption_id: string(row.caption_id, 500) || null, caption_en: string(row.caption_en, 500) || null, display_order: Number.isInteger(row.display_order) ? Math.max(0, Number(row.display_order)) : 0 }]
  })
  if (media.length !== mediaInput.length) return undefined
  if (media.filter((item) => item.media_type === 'cover').length > 1) return undefined
  if (status === 'published' && (translations.some((row) => !row.title || !row.short_description || !row.description) || !media.some((item) => item.media_type === 'cover'))) return undefined
  const project: Project = {
    ...(typeof input.id === 'string' && /^[0-9a-f-]{36}$/i.test(input.id) ? { id: input.id } : {}),
    slug, category, status, featured: input.featured === true,
    display_order: Number.isInteger(input.display_order) ? Math.max(0, Number(input.display_order)) : 100,
    project_url: optionalUrl(input.project_url), github_url: optionalUrl(input.github_url),
    start_date: validDate(input.start_date), end_date: validDate(input.end_date),
  }
  if (media.some((item) => item.project_id && project.id && item.project_id !== project.id)) return undefined
  return { project, translations: translations.map((row) => ({ ...row, project_id: project.id ?? '' })), media: media.map((row) => ({ ...row, project_id: project.id ?? '' })) }
}

export function bundleToJson(bundle: ProjectBundle): { p_project: Json; p_translations: Json; p_media: Json } {
  return { p_project: bundle.project as Json, p_translations: bundle.translations as Json, p_media: bundle.media as Json }
}
