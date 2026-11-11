type SaveReply = { data: string | null; error: { message: string } | null }

export type SaveProjectResult<T> =
  | { saved: false; error: string }
  | { saved: true; id: string; record?: T; cacheRevalidated: boolean; warning?: string }

/** Persists first, invalidates public content immediately, then refreshes the admin view. */
export async function saveProjectWithRefresh<T>(options: {
  save: () => Promise<SaveReply>
  revalidate: () => void
  reload: (id: string) => Promise<T | null | undefined>
}): Promise<SaveProjectResult<T>> {
  let result: SaveReply
  try {
    result = await options.save()
  } catch (error) {
    return { saved: false, error: error instanceof Error ? error.message : 'Proyek gagal disimpan.' }
  }

  if (result.error || !result.data) {
    return { saved: false, error: result.error?.message ?? 'Proyek gagal disimpan.' }
  }

  const id = result.data
  let cacheRevalidated = true
  const warnings: string[] = []
  try {
    options.revalidate()
  } catch {
    cacheRevalidated = false
    warnings.push('Penyimpanan berhasil, tetapi pembaruan cache publik tidak dapat dikonfirmasi.')
  }

  let record: T | null | undefined
  try {
    record = await options.reload(id)
  } catch {
    record = undefined
  }

  if (!record) {
    warnings.push('Data dashboard gagal dimuat ulang. Perubahan sudah tersimpan; muat ulang daftar admin dan jangan ulangi publikasi.')
  }

  return {
    saved: true,
    id,
    ...(record ? { record } : {}),
    cacheRevalidated,
    ...(warnings.length ? { warning: warnings.join(' ') } : {}),
  }
}
