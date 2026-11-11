import 'server-only'
import type { ProjectSourceFields, ProjectEnglishFields } from './project-fields'
import { getDeepLEndpoint, translateProjectWithDeepL } from './deepl-client'

export async function translateProject(source: ProjectSourceFields): Promise<ProjectEnglishFields> {
  const apiKey = process.env.DEEPL_AUTH_KEY?.trim() ?? ''
  if (!apiKey) throw new Error('Layanan terjemahan belum dikonfigurasi. Tambahkan DEEPL_AUTH_KEY di server.')
  return translateProjectWithDeepL({
    source,
    apiKey,
    endpoint: getDeepLEndpoint(apiKey, process.env.DEEPL_API_URL),
  })
}
