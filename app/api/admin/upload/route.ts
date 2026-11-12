import { NextRequest, NextResponse } from 'next/server'
import { revalidatePublicProjects } from '@/lib/revalidate-public-projects'
import { adminAccessError, authorizeAdmin } from '@/lib/supabase/auth'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { isAllowedAdminOrigin } from '@/lib/admin-origin'
import { createImageStoragePath, imageExtensionForBytes, ImagePersistenceError, IMAGE_MIME_TYPES, MAX_IMAGE_SIZE, uploadAndPersistImage } from '@/lib/admin-media'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function noStore(body: object, status = 200) { return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } }) }
function sameOrigin(request: NextRequest) { return isAllowedAdminOrigin(request.headers.get('origin'), request.url) }

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return noStore({ error: 'Permintaan tidak valid.' }, 403)
  if (!isSupabaseConfigured) return noStore({ error: 'Supabase belum dikonfigurasi; unggah dinonaktifkan.' }, 503)
  const { supabase, access } = await authorizeAdmin()
  if (access.status !== 'allowed') return adminAccessError(access.status)

  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_IMAGE_SIZE + 128 * 1024) return noStore({ error: 'Ukuran permintaan gambar maksimal 10 MB.' }, 413)
  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  const projectId = formData?.get('projectId')
  const mediaType = formData?.get('mediaType')
  const uploadId = formData?.get('uploadId')
  const displayOrderValue = formData?.get('displayOrder')
  const replacementValue = formData?.get('replaceStoragePath')
  const replaceStoragePath = typeof replacementValue === 'string' && replacementValue ? replacementValue : undefined
  if (!(file instanceof File) || typeof projectId !== 'string' || !uuidPattern.test(projectId) || (mediaType !== 'cover' && mediaType !== 'gallery') || typeof uploadId !== 'string' || !uuidPattern.test(uploadId)) {
    return noStore({ error: 'Pilih file, jenis media, dan simpan draf proyek terlebih dahulu.' }, 400)
  }
  const displayOrder = typeof displayOrderValue === 'string' && /^\d+$/.test(displayOrderValue) ? Number(displayOrderValue) : 0
  if (!Number.isSafeInteger(displayOrder) || displayOrder > 100_000) return noStore({ error: 'Urutan gambar tidak valid.' }, 400)
  if (replaceStoragePath && !replaceStoragePath.startsWith(`projects/${projectId}/`)) return noStore({ error: 'Gambar pengganti bukan milik proyek ini.' }, 400)
  if (!file.size || file.size > MAX_IMAGE_SIZE) return noStore({ error: 'Ukuran gambar maksimal 10 MB.' }, 413)
  if (!IMAGE_MIME_TYPES.includes(file.type as (typeof IMAGE_MIME_TYPES)[number])) return noStore({ error: 'Format yang didukung: JPEG, PNG, WebP, atau AVIF.' }, 415)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const extension = imageExtensionForBytes(file.type, bytes)
  if (!extension) return noStore({ error: 'Isi file tidak sesuai dengan format gambar yang dipilih.' }, 415)

  const { data: project, error: projectError } = await supabase.from('projects').select('id,status,slug').eq('id', projectId).maybeSingle()
  if (projectError || !project) return noStore({ error: 'Proyek draf tidak ditemukan.' }, 404)
  const storage = supabase.storage.from('portfolio-media')
  const storagePath = createImageStoragePath(projectId, uploadId, extension)

  const { data: alreadySaved, error: duplicateCheckError } = await supabase.from('project_media').select('*').eq('storage_path', storagePath).maybeSingle()
  if (duplicateCheckError) return noStore({ error: `Gagal memeriksa metadata gambar: ${duplicateCheckError.message}` }, 500)
  if (alreadySaved) {
    if (alreadySaved.project_id !== projectId || alreadySaved.media_type !== mediaType) return noStore({ error: 'ID unggahan ini sudah digunakan untuk gambar lain.' }, 409)
    let warning: string | undefined
    if (replaceStoragePath && replaceStoragePath !== storagePath) {
      const { data: oldReference, error: referenceError } = await supabase.from('project_media').select('id').eq('storage_path', replaceStoragePath).maybeSingle()
      if (!referenceError && !oldReference) {
        const { error: cleanupError } = await storage.remove([replaceStoragePath])
        if (cleanupError) warning = `Gambar baru tersimpan, tetapi gambar lama masih tertinggal di Storage: ${replaceStoragePath}.`
      }
    }
    return noStore({ media: { ...alreadySaved, url: storage.getPublicUrl(storagePath).data.publicUrl }, ...(warning ? { warning } : {}), idempotent: true })
  }

  let targetMedia = replaceStoragePath
  if (mediaType === 'cover' && !targetMedia) {
    const { data: currentCover, error } = await supabase.from('project_media').select('*').eq('project_id', projectId).eq('media_type', 'cover').maybeSingle()
    if (error) return noStore({ error: `Gagal memeriksa gambar sampul: ${error.message}` }, 500)
    targetMedia = currentCover?.storage_path
  }

  let previousMedia: { id: string; project_id: string; storage_path: string; media_type: 'cover' | 'gallery'; alt_text_id: string; alt_text_en: string; caption_id: string | null; caption_en: string | null; display_order: number; created_at: string } | null = null
  if (targetMedia) {
    const { data, error } = await supabase.from('project_media').select('*').eq('project_id', projectId).eq('storage_path', targetMedia).maybeSingle()
    if (error) return noStore({ error: `Gagal memeriksa gambar pengganti: ${error.message}` }, 500)
    if (!data || data.media_type !== mediaType) return noStore({ error: 'Gambar yang akan diganti tidak ditemukan atau jenisnya berbeda.' }, 404)
    previousMedia = data
  } else if (replaceStoragePath) {
    return noStore({ error: 'Gambar yang akan diganti tidak ditemukan.' }, 404)
  }

  try {
    const result = await uploadAndPersistImage({
      storagePath,
      replacedStoragePath: previousMedia?.storage_path,
      upload: async () => {
        const { error } = await storage.upload(storagePath, bytes, { contentType: file.type, cacheControl: '31536000', upsert: true })
        if (error) throw new Error(error.message)
      },
      persistMetadata: async () => {
        if (previousMedia) {
          const { data, error } = await supabase.from('project_media').update({ storage_path: storagePath }).eq('id', previousMedia.id).eq('project_id', projectId).select('*').single()
          if (error || !data) throw new Error(error?.message ?? 'Metadata penggantian gambar tidak tersimpan.')
          return data
        }
        const { data, error } = await supabase.from('project_media').insert({
          project_id: projectId,
          storage_path: storagePath,
          media_type: mediaType,
          alt_text_id: '',
          alt_text_en: '',
          caption_id: null,
          caption_en: null,
          display_order: displayOrder,
        }).select('*').single()
        if (error || !data) throw new Error(error?.message ?? 'Metadata gambar tidak tersimpan.')
        return data
      },
      removeNewObject: async () => {
        const { error } = await storage.remove([storagePath])
        if (error) throw new Error(error.message)
      },
      removeReplacedObject: previousMedia ? async () => {
        const { error } = await storage.remove([previousMedia!.storage_path])
        if (error) throw new Error(error.message)
      } : undefined,
    })
    if (project.status === 'published') revalidatePublicProjects(project.slug)
    return noStore({ media: { ...result.record, url: storage.getPublicUrl(storagePath).data.publicUrl }, ...(result.warning ? { warning: result.warning } : {}) }, 201)
  } catch (error) {
    if (error instanceof ImagePersistenceError) {
      return noStore({ error: error.message, ...(error.orphanedStoragePath ? { orphanedStoragePath: error.orphanedStoragePath } : {}) }, error.orphanedStoragePath ? 500 : 502)
    }
    return noStore({ error: `Gambar gagal diunggah ke Supabase Storage: ${error instanceof Error ? error.message : 'storage error'}` }, 502)
  }
}
