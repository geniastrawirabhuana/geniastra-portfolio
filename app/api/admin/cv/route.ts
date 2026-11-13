import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { adminAccessError, authorizeAdmin } from '@/lib/supabase/auth'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { isAllowedAdminOrigin } from '@/lib/admin-origin'
import { CvUploadError, MAX_CV_FILE_SIZE, uploadPublicCvPdf } from '@/lib/cv-upload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function noStore(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
  if (!isAllowedAdminOrigin(request.headers.get('origin'), request.url)) {
    return noStore({ error: 'Permintaan tidak valid.' }, 403)
  }
  if (!isSupabaseConfigured) return noStore({ error: 'Supabase belum dikonfigurasi; unggah CV dinonaktifkan.' }, 503)

  const { supabase, access } = await authorizeAdmin()
  if (access.status !== 'allowed') return adminAccessError(access.status)

  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_CV_FILE_SIZE + 64 * 1024) return noStore({ error: 'Ukuran CV maksimal 5 MB.' }, 413)

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) return noStore({ error: 'Pilih file CV PDF terlebih dahulu.' }, 400)

  try {
    const bucket = supabase.storage.from('public-documents')
    const result = await uploadPublicCvPdf(file, bucket, randomUUID)
    return noStore({ publicUrl: result.publicUrl, fileName: file.name })
  } catch (error) {
    if (error instanceof CvUploadError) return noStore({ error: error.message }, error.status)
    return noStore({ error: 'CV gagal diunggah. Silakan coba lagi.' }, 502)
  }
}
