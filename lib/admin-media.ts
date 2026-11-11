export const MAX_IMAGE_SIZE = 10 * 1024 * 1024

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const

export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number]
export type ImageMediaType = 'cover' | 'gallery'
export type PendingImage = { id: string; file: File; target: ImageMediaType; replaceStoragePath?: string; previewUrl: string; status: 'queued' | 'uploading' | 'error' }

export function validateImageFile(file: Pick<File, 'type' | 'size' | 'name'>) {
  if (!IMAGE_MIME_TYPES.includes(file.type as ImageMimeType)) {
    return `${file.name}: format yang didukung JPEG, PNG, WebP, dan AVIF.`
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
    return `${file.name}: ukuran harus lebih dari 0 dan maksimal 10 MB.`
  }
  return null
}

export function imageExtensionForBytes(mimeType: string, bytes: Uint8Array) {
  const valid = (condition: boolean, extension: string) => condition ? extension : undefined
  switch (mimeType) {
    case 'image/jpeg': return valid(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff, 'jpg')
    case 'image/png': return valid(bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47, 'png')
    case 'image/webp': return valid(String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP', 'webp')
    case 'image/avif': return valid(String.fromCharCode(...bytes.slice(4, 12)).includes('ftypavif') || String.fromCharCode(...bytes.slice(4, 12)).includes('ftypavis'), 'avif')
    default: return undefined
  }
}

export function openNativeFilePicker(input: Pick<HTMLInputElement, 'click'> | null | undefined) {
  input?.click()
}

export function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function createImageStoragePath(projectId: string, uploadId: string, extension: string) {
  return `projects/${projectId}/${uploadId}.${extension}`
}

export function queueImageFiles(options: {
  current: PendingImage[]
  existingMediaCount: number
  existingCoverPath?: string
  files: ArrayLike<File> | null
  target: ImageMediaType
  replaceStoragePath?: string
  createId: () => string
  createPreview: (file: File) => string
}) {
  if (!options.files?.length) return { pending: options.current, errors: [] as string[] }
  const files = Array.from(options.files)
  const valid: File[] = []
  const errors: string[] = []
  for (const file of files) {
    const error = validateImageFile(file)
    if (error) errors.push(error)
    else valid.push(file)
  }
  if (options.target === 'cover' && valid.length > 1) errors.push('Pilih satu gambar sampul saja.')
  const candidates = options.target === 'cover' ? valid.slice(0, 1) : valid
  const remaining = options.target === 'cover'
    ? options.current.filter((item) => item.target !== 'cover')
    : options.replaceStoragePath
      ? options.current.filter((item) => item.replaceStoragePath !== options.replaceStoragePath)
      : options.current
  const currentTotal = options.existingMediaCount + remaining.filter((item) => !item.replaceStoragePath).length
  const capacity = Math.max(0, 13 - currentTotal)
  const accepted = options.target === 'cover' ? candidates : candidates.slice(0, capacity)
  if (options.target === 'gallery' && accepted.length < candidates.length) errors.push('Batas gambar proyek adalah satu sampul dan dua belas gambar galeri.')
  const automaticReplacement = options.target === 'cover' ? options.existingCoverPath : undefined
  const additions = accepted.map((file): PendingImage => ({
    id: options.createId(),
    file,
    target: options.target,
    ...(options.replaceStoragePath || automaticReplacement ? { replaceStoragePath: options.replaceStoragePath ?? automaticReplacement } : {}),
    previewUrl: options.createPreview(file),
    status: 'queued',
  }))
  return { pending: [...remaining, ...additions], errors }
}

export class ImagePersistenceError extends Error {
  readonly orphanedStoragePath?: string

  constructor(message: string, orphanedStoragePath?: string) {
    super(message)
    this.name = 'ImagePersistenceError'
    this.orphanedStoragePath = orphanedStoragePath
  }
}

/** Saves metadata only after Storage confirms upload and cleans up failed writes. */
export async function uploadAndPersistImage<T>(options: {
  storagePath: string
  replacedStoragePath?: string
  upload: () => Promise<void>
  persistMetadata: () => Promise<T>
  removeNewObject: () => Promise<void>
  removeReplacedObject?: () => Promise<void>
}) {
  await options.upload()

  let record: T
  try {
    record = await options.persistMetadata()
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'database error'
    try {
      await options.removeNewObject()
    } catch {
      throw new ImagePersistenceError(
        `Metadata gagal disimpan (${reason}); objek baru tertinggal di ${options.storagePath}. Coba simpan ulang metadata atau hapus objek tersebut dari Storage.`,
        options.storagePath,
      )
    }
    throw new ImagePersistenceError(`Metadata gagal disimpan (${reason}); objek baru berhasil dibersihkan.`)
  }

  if (options.replacedStoragePath && options.removeReplacedObject) {
    try {
      await options.removeReplacedObject()
    } catch {
      return { record, warning: `Gambar baru tersimpan, tetapi gambar lama masih tertinggal di Storage: ${options.replacedStoragePath}.` }
    }
  }

  return { record }
}
