import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminAccess } from '@/lib/supabase/auth'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function noStore(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}
function sameOrigin(request: NextRequest) { return request.headers.get('origin') === new URL(request.url).origin }

export async function GET() {
  if (!isSupabaseConfigured) return noStore({ configured: false, authenticated: false, translationAvailable: false }, 503)
  const access = await getAdminAccess()
  return noStore({ configured: true, authenticated: access.status === 'allowed', forbidden: access.status === 'forbidden', translationAvailable: Boolean(process.env.DEEPL_AUTH_KEY?.trim()) }, access.status === 'forbidden' ? 403 : 200)
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return noStore({ error: 'Permintaan tidak valid.' }, 403)
  if (!isSupabaseConfigured) return noStore({ error: 'Supabase belum dikonfigurasi. Admin dinonaktifkan.' }, 503)
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().slice(0, 254) : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email || !password || password.length > 1024) return noStore({ error: 'Masukkan email dan password.' }, 400)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return noStore({ error: 'Email atau password tidak cocok.' }, 401)
  const access = await getAdminAccess()
  if (access.status !== 'allowed') {
    await supabase.auth.signOut()
    return noStore({ error: 'Akun ini belum diizinkan sebagai admin.' }, 403)
  }
  return noStore({ authenticated: true })
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return noStore({ error: 'Permintaan tidak valid.' }, 403)
  if (!isSupabaseConfigured) return noStore({ authenticated: false })
  const supabase = await createClient()
  await supabase.auth.signOut()
  return noStore({ authenticated: false })
}
