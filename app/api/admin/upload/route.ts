import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { adminAccessError, authorizeAdmin } from '@/lib/supabase/auth'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const fileTypes = new Map([
  ['image/jpeg', { extension: 'jpg', signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ['image/png', { extension: 'png', signature: (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 }],
  ['image/webp', { extension: 'webp', signature: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' }],
  ['image/avif', { extension: 'avif', signature: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(4, 12)).includes('ftypavif') || String.fromCharCode(...bytes.slice(4, 12)).includes('ftypavis') }],
])
function sameOrigin(request: NextRequest) { return request.headers.get('origin') === new URL(request.url).origin }

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 403 })
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Supabase belum dikonfigurasi; unggah dinonaktifkan.' }, { status: 503 })
  const { supabase, access } = await authorizeAdmin()
  if (access.status !== 'allowed') return adminAccessError(access.status)
  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  const projectId = formData?.get('projectId')
  if (!(file instanceof File) || typeof projectId !== 'string' || !/^[0-9a-f-]{36}$/i.test(projectId)) return NextResponse.json({ error: 'Pilih gambar dan simpan draf proyek terlebih dahulu.' }, { status: 400 })
  if (!file.size || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Ukuran gambar maksimal 10 MB.' }, { status: 413 })
  const type = fileTypes.get(file.type)
  if (!type) return NextResponse.json({ error: 'Format yang didukung: JPEG, PNG, WebP, atau AVIF.' }, { status: 415 })
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!type.signature(bytes)) return NextResponse.json({ error: 'Isi file tidak sesuai dengan format gambar yang dipilih.' }, { status: 415 })
  const { data: project, error: projectError } = await supabase.from('projects').select('id').eq('id', projectId).maybeSingle()
  if (projectError || !project) return NextResponse.json({ error: 'Proyek draf tidak ditemukan.' }, { status: 404 })
  const storagePath = `projects/${projectId}/${randomUUID()}.${type.extension}`
  const { error } = await supabase.storage.from('portfolio-media').upload(storagePath, bytes, { contentType: file.type, cacheControl: '31536000', upsert: false })
  if (error) return NextResponse.json({ error: `Gambar gagal diunggah: ${error.message}` }, { status: 502 })
  const url = supabase.storage.from('portfolio-media').getPublicUrl(storagePath).data.publicUrl
  return NextResponse.json({ storage_path: storagePath, url }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
}
