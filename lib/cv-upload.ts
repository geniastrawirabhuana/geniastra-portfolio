export const MAX_CV_FILE_SIZE = 5 * 1024 * 1024
const PDF_SIGNATURE = new TextEncoder().encode('%PDF-')

export type CvUploadFile = Pick<File, 'type' | 'size' | 'arrayBuffer'>
export type CvStorageBucket = {
  upload: (path: string, body: Uint8Array, options: { contentType: string; upsert: false; cacheControl: string }) => Promise<{ error: unknown | null }>
  getPublicUrl: (path: string) => { data: { publicUrl: string } }
}

export class CvUploadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'CvUploadError'
  }
}

export function validateCvFileMetadata(file: Pick<CvUploadFile, 'type' | 'size'>) {
  if (!file.size || file.size > MAX_CV_FILE_SIZE) {
    throw new CvUploadError('Ukuran CV maksimal 5 MB.', 413)
  }
  if (file.type !== 'application/pdf') {
    throw new CvUploadError('Format file CV harus PDF.', 415)
  }
}

function hasPdfSignature(bytes: Uint8Array) {
  const limit = Math.min(bytes.length - PDF_SIGNATURE.length, 1024)
  for (let offset = 0; offset <= limit; offset += 1) {
    if (PDF_SIGNATURE.every((byte, index) => bytes[offset + index] === byte)) return true
  }
  return false
}

export async function uploadPublicCvPdf(
  file: CvUploadFile,
  bucket: CvStorageBucket,
  createId: () => string,
) {
  validateCvFileMetadata(file)
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!hasPdfSignature(bytes)) throw new CvUploadError('Isi file tidak memiliki signature PDF yang valid.', 400)

  const storagePath = `contact/cv-${createId()}.pdf`
  const publicUrl = bucket.getPublicUrl(storagePath).data.publicUrl
  if (!publicUrl) throw new CvUploadError('URL publik CV tidak dapat dibuat.', 502)

  const { error } = await bucket.upload(storagePath, bytes, {
    contentType: 'application/pdf',
    upsert: false,
    cacheControl: '31536000',
  })
  if (error) throw new CvUploadError('CV gagal diunggah ke Supabase Storage.', 502)

  return { storagePath, publicUrl }
}
