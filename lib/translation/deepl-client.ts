import type { ProjectSourceFields, ProjectEnglishFields } from './project-fields.ts'
import { mapTranslatedFields, PROJECT_TRANSLATION_FIELDS } from './project-fields.ts'

export class DeepLProviderError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'DeepLProviderError'
    this.status = status
  }
}

export function getDeepLEndpoint(apiKey: string, configuredEndpoint?: string) {
  const endpoint = configuredEndpoint?.trim() || (apiKey.trim().endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate')
  const url = new URL(endpoint)
  if (url.protocol !== 'https:' || !['api.deepl.com', 'api-free.deepl.com'].includes(url.hostname) || url.pathname !== '/v2/translate' || url.search || url.hash) {
    throw new Error('DEEPL_API_URL harus memakai endpoint resmi DeepL /v2/translate.')
  }
  return url.toString()
}

export async function translateProjectWithDeepL(options: {
  source: ProjectSourceFields
  apiKey: string
  endpoint: string
  fetcher?: typeof fetch
}): Promise<ProjectEnglishFields> {
  if (!options.apiKey.trim()) throw new DeepLProviderError('Translation service is not configured.')
  const texts = PROJECT_TRANSLATION_FIELDS.flatMap((field) => {
    const value = options.source[field]
    if (field === 'scope') return value
    return value ? [value] : []
  })
  if (!texts.length) throw new DeepLProviderError('Tambahkan konten Bahasa Indonesia sebelum menerjemahkan.', 400)

  let response: Response
  try {
    response = await (options.fetcher ?? fetch)(options.endpoint, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${options.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: texts,
        source_lang: 'ID',
        target_lang: 'EN-US',
        preserve_formatting: true,
        context: 'Portfolio project content. Preserve official project names, product names, brands, proper nouns, framework and technology names, and programming terminology exactly as written. Translate only the surrounding Indonesian language into natural professional English. Do not add facts, achievements, or capabilities.',
      }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new DeepLProviderError('Layanan terjemahan tidak dapat dihubungi.')
  }
  if (!response.ok) {
    const status = response.status
    throw new DeepLProviderError(
      status === 429 ? 'DeepL sedang membatasi permintaan. Tunggu sebentar lalu coba lagi.' : 'Layanan DeepL gagal menerjemahkan konten.',
      status,
    )
  }

  let data: unknown
  try { data = await response.json() } catch { throw new DeepLProviderError('Respons DeepL tidak valid.') }
  const translations = data && typeof data === 'object' && 'translations' in data && Array.isArray(data.translations)
    ? data.translations as Array<{ text?: unknown }>
    : []
  return mapTranslatedFields(options.source, translations.map((item) => typeof item?.text === 'string' ? item.text : ''))
}
