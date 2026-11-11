import { NextRequest, NextResponse } from 'next/server'
import { authorizeAdmin, adminAccessError } from '@/lib/supabase/auth'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { normalizeProjectSourceFields, MAX_TRANSLATION_REQUEST_BYTES } from '@/lib/translation/project-fields'
import { translateProject } from '@/lib/translation/service'
import { DeepLProviderError } from '@/lib/translation/deepl-client'
import { allowTranslationRequest } from '@/lib/translation/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function noStore(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

async function readLimitedJson(request: NextRequest) {
  const reader = request.body?.getReader()
  if (!reader) return { value: null, tooLarge: false }
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_TRANSLATION_REQUEST_BYTES) {
      await reader.cancel()
      return { value: null, tooLarge: true }
    }
    chunks.push(value)
  }
  try {
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return { value: JSON.parse(new TextDecoder().decode(bytes)) as unknown, tooLarge: false }
  } catch {
    return { value: null, tooLarge: false }
  }
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return noStore({ error: 'Permintaan tidak valid.' }, 403)
  if (!isSupabaseConfigured) return noStore({ error: 'Supabase belum dikonfigurasi.' }, 503)
  const { access } = await authorizeAdmin()
  if (access.status !== 'allowed') return adminAccessError(access.status)
  if (!access.userId) return noStore({ error: 'Sesi admin tidak valid.' }, 401)
  if (!process.env.DEEPL_AUTH_KEY?.trim()) return noStore({ error: 'Layanan terjemahan belum dikonfigurasi. Tambahkan DEEPL_AUTH_KEY di server.' }, 503)
  if (!allowTranslationRequest(access.userId)) return noStore({ error: 'Batas terjemahan tercapai. Tunggu satu menit sebelum mencoba lagi.' }, 429)

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_TRANSLATION_REQUEST_BYTES) return noStore({ error: 'Konten terlalu besar untuk diterjemahkan.' }, 413)
  const parsed = await readLimitedJson(request)
  if (parsed.tooLarge) return noStore({ error: 'Konten terlalu besar untuk diterjemahkan.' }, 413)
  const body = parsed.value as { source?: unknown } | null
  const source = normalizeProjectSourceFields(body?.source)
  if (!source) return noStore({ error: 'Isi Bahasa Indonesia kosong atau melewati batas yang diizinkan.' }, 400)

  try {
    return noStore({ translations: await translateProject(source) })
  } catch (error) {
    if (error instanceof DeepLProviderError && error.status === 429) return noStore({ error: error.message }, 429)
    if (error instanceof DeepLProviderError && error.status === 400) return noStore({ error: error.message }, 400)
    return noStore({ error: error instanceof Error ? error.message : 'Terjemahan gagal. Coba lagi nanti.' }, 502)
  }
}
