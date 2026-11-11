import type { Locale } from '@/content/portfolio'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export type AdminTranslation = { title: string; short_description: string; description: string; role: string; period_label: string; mark: string; scope: string[]; seo_title: string; seo_description: string }
export type AdminMedia = { storage_path: string; media_type: 'cover' | 'gallery'; alt_text_id: string; alt_text_en: string; caption_id: string; caption_en: string; display_order: number }
export type AdminProjectRecord = { id: string; slug: string; category: string; status: 'draft' | 'published'; featured: boolean; display_order: number; project_url: string | null; github_url: string | null; start_date: string | null; end_date: string | null; project_translations: Array<AdminTranslation & { locale: Locale }>; project_media: AdminMedia[] }

export function projectForAdmin(row: AdminProjectRecord) {
  const translation = (locale: Locale): AdminTranslation => row.project_translations.find((item) => item.locale === locale) ?? { title: '', short_description: '', description: '', role: '', period_label: '', mark: '', scope: [], seo_title: '', seo_description: '' }
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  return { ...row, title: translation('en').title || translation('id').title, translations: { id: translation('id'), en: translation('en') }, media: [...row.project_media].sort((a, b) => a.display_order - b.display_order || a.storage_path.localeCompare(b.storage_path)).map((item) => ({ ...item, url: baseUrl ? `${baseUrl}/storage/v1/object/public/portfolio-media/${item.storage_path}` : undefined })) }
}

export async function loadAdminProjectRows(supabase: SupabaseClient<Database>, ids?: string[]) {
  let projectQuery = supabase.from('projects').select('*').order('display_order').order('created_at', { ascending: false })
  if (ids) projectQuery = projectQuery.in('id', ids)
  const { data: rows, error } = await projectQuery
  if (error) throw new Error(error.message)
  const projectRows = rows ?? []
  const projectIds = projectRows.map((row) => row.id)
  if (!projectIds.length) return [] as AdminProjectRecord[]
  const [{ data: translations, error: translationError }, { data: media, error: mediaError }] = await Promise.all([
    supabase.from('project_translations').select('*').in('project_id', projectIds),
    supabase.from('project_media').select('*').in('project_id', projectIds),
  ])
  if (translationError || mediaError) throw new Error(translationError?.message ?? mediaError?.message ?? 'Unable to load project details.')
  return projectRows.map((row) => ({
    ...row,
    project_translations: (translations ?? []).filter((translation) => translation.project_id === row.id),
    project_media: (media ?? []).filter((item) => item.project_id === row.id),
  })) as AdminProjectRecord[]
}
