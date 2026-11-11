import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { adminAccessError, authorizeAdmin } from '@/lib/supabase/auth'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { normalizeSiteContent } from '@/lib/admin-site-validation'
import { getSiteContent, saveSiteContent } from '@/lib/site-content'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
  const { access } = await authorizeAdmin()
  if (access.status !== 'allowed') return adminAccessError(access.status)
  return NextResponse.json(await getSiteContent(), { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase belum dikonfigurasi; perubahan admin dinonaktifkan.' }, { status: 503 })
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 403 })
  const { access } = await authorizeAdmin()
  if (access.status !== 'allowed') return adminAccessError(access.status)
  const body = await request.json().catch(() => null)
  const content = normalizeSiteContent(body)
  if (!content) return NextResponse.json({ error: 'Periksa nama situs, konten Indonesia dan Inggris, serta data pendidikan dan organisasi.' }, { status: 400 })
  await saveSiteContent(content)
  for (const locale of ['id', 'en']) {
    revalidatePath(`/${locale}`)
    revalidatePath(`/${locale}/about`)
    revalidatePath(`/${locale}/contact`)
    revalidatePath(`/${locale}/experience`)
  }
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'private, no-store' } })
}
