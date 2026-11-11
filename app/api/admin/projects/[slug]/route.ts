import { NextRequest, NextResponse } from 'next/server'
import { revalidatePublicProjects } from '@/lib/revalidate-public-projects'
import { adminAccessError, authorizeAdmin } from '@/lib/supabase/auth'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { loadAdminProjectRows, projectForAdmin } from '@/lib/supabase/admin-projects'
import { adminProjectSnapshot } from '@/lib/supabase/admin-project-snapshot'
import { bundleToJson, normalizeProjectBundle } from '@/lib/supabase/project-validation'
import { saveProjectWithRefresh } from '@/lib/supabase/save-project-with-refresh'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ slug: string }> }
function sameOrigin(request: NextRequest) { return request.headers.get('origin') === new URL(request.url).origin }

export async function PUT(request: NextRequest, { params }: Context) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 403 })
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase belum dikonfigurasi; perubahan admin dinonaktifkan.' }, { status: 503 })
  const { supabase, access } = await authorizeAdmin()
  if (access.status !== 'allowed') return adminAccessError(access.status)
  const { slug: oldSlug } = await params
  const { data: existing, error: existingError } = await supabase.from('projects').select('id').eq('slug', oldSlug).maybeSingle()
  if (existingError || !existing) return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 })
  const { data: existingMedia, error: mediaReadError } = await supabase.from('project_media').select('storage_path').eq('project_id', existing.id)
  if (mediaReadError) return NextResponse.json({ error: `Gagal memeriksa media proyek: ${mediaReadError.message}` }, { status: 500 })
  const input = await request.json().catch(() => null)
  if (!input || typeof input !== 'object') return NextResponse.json({ error: 'Format data proyek tidak valid.' }, { status: 400 })
  const body = { ...(input as Record<string, unknown>), id: existing.id }
  const bundle = normalizeProjectBundle(body)
  const bodyMedia = (body as Record<string, unknown>).media
  const originalMediaCount = Array.isArray(bodyMedia) ? bodyMedia.length : 0
  if (!bundle || bundle.media.length !== originalMediaCount || bundle.media.some((item) => !item.storage_path.startsWith(`projects/${existing.id}/`))) return NextResponse.json({ error: 'Periksa slug, kategori, terjemahan, dan metadata gambar proyek.' }, { status: 400 })
  const oldPaths = (existingMedia ?? []).map((item) => item.storage_path)
  const result = await saveProjectWithRefresh({
    save: async () => {
      const { data, error } = await supabase.rpc('save_project_bundle', bundleToJson(bundle))
      return { data, error }
    },
    revalidate: () => revalidatePublicProjects(oldSlug, bundle.project.slug),
    reload: async (id) => {
      const [saved] = await loadAdminProjectRows(supabase, [id])
      return saved ?? null
    },
  })
  if (!result.saved) return NextResponse.json({ error: result.error }, { status: 400 })
  const keptPaths = new Set(bundle.media.map((item) => item.storage_path))
  const removedPaths = oldPaths.filter((path) => !keptPaths.has(path))
  let cleanupWarning: string | undefined
  if (removedPaths.length) {
    const { error: storageError } = await supabase.storage.from('portfolio-media').remove(removedPaths)
    if (storageError) cleanupWarning = 'Data tersimpan, tetapi sebagian gambar lama gagal dibersihkan dari Storage.'
  }
  const project = result.record ? projectForAdmin(result.record) : adminProjectSnapshot(bundle, result.id)
  const warning = [result.warning, cleanupWarning].filter(Boolean).join(' ')
  return NextResponse.json({ project, ...(warning ? { warning } : {}) }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 403 })
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase belum dikonfigurasi; perubahan admin dinonaktifkan.' }, { status: 503 })
  const { supabase, access } = await authorizeAdmin()
  if (access.status !== 'allowed') return adminAccessError(access.status)
  const { slug } = await params
  const { data: existing, error: existingError } = await supabase.from('projects').select('id').eq('slug', slug).maybeSingle()
  if (existingError || !existing) return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 })
  const { data: mediaRows, error: mediaReadError } = await supabase.from('project_media').select('storage_path').eq('project_id', existing.id)
  if (mediaReadError) return NextResponse.json({ error: `Gagal memeriksa media proyek: ${mediaReadError.message}` }, { status: 500 })
  const paths = (mediaRows ?? []).map((item) => item.storage_path)
  const { error } = await supabase.from('projects').delete().eq('id', existing.id)
  if (error) return NextResponse.json({ error: `Proyek gagal dihapus: ${error.message}` }, { status: 400 })
  let warning: string | undefined
  if (paths.length) {
    const { error: cleanupError } = await supabase.storage.from('portfolio-media').remove(paths)
    if (cleanupError) warning = 'Proyek dihapus, tetapi sebagian gambar yatim gagal dibersihkan dari Storage.'
  }
  revalidatePublicProjects(slug)
  return NextResponse.json({ success: true, ...(warning ? { warning } : {}) }, { headers: { 'Cache-Control': 'private, no-store' } })
}
