import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePublicProjects } from '@/lib/revalidate-public-projects'
import { adminAccessError, authorizeAdmin } from '@/lib/supabase/auth'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { loadAdminProjectRows, projectForAdmin } from '@/lib/supabase/admin-projects'
import { bundleToJson, normalizeProjectBundle } from '@/lib/supabase/project-validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sameOrigin(request: NextRequest) { return request.headers.get('origin') === new URL(request.url).origin }
export async function GET() {
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
  const { supabase, access } = await authorizeAdmin()
  if (access.status !== 'allowed') return adminAccessError(access.status)
  try {
    const rows = await loadAdminProjectRows(supabase)
    return NextResponse.json({ projects: rows.map(projectForAdmin) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({ error: `Gagal memuat proyek: ${error instanceof Error ? error.message : 'database error'}` }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 403 })
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase belum dikonfigurasi; perubahan admin dinonaktifkan.' }, { status: 503 })
  const { supabase, access } = await authorizeAdmin()
  if (access.status !== 'allowed') return adminAccessError(access.status)
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (body?.createDraft === true) {
    const slug = `draft-${randomUUID()}`
    const { data, error } = await supabase.from('projects').insert({ slug, status: 'draft' }).select('id, slug').single()
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Draf gagal dibuat.' }, { status: 400 })
    revalidatePublicProjects(slug)
    return NextResponse.json({ project: { id: data.id, slug: data.slug, status: 'draft', category: 'other', featured: false, display_order: 100, translations: { id: {}, en: {} }, media: [] } }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
  }
  const bundle = normalizeProjectBundle(body)
  const inputMediaCount = body && Array.isArray(body.media) ? body.media.length : 0
  if (!bundle || bundle.project.id || bundle.media.length !== inputMediaCount || bundle.media.length > 0) return NextResponse.json({ error: 'Simpan draf sebelum mengunggah gambar; periksa juga slug, kategori, dan terjemahan.' }, { status: 400 })
  const { data, error } = await supabase.rpc('save_project_bundle', bundleToJson(bundle))
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Proyek gagal disimpan.' }, { status: 400 })
  const [saved] = await loadAdminProjectRows(supabase, [data]).catch(() => [])
  if (!saved) return NextResponse.json({ error: 'Proyek tersimpan, tetapi data belum dapat dimuat ulang.' }, { status: 500 })
  revalidatePublicProjects(bundle.project.slug)
  return NextResponse.json({ project: projectForAdmin(saved) }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
}
