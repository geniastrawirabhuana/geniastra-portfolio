export const PROJECT_TRANSLATION_FIELDS = [
  'title',
  'short_description',
  'description',
  'role',
  'scope',
] as const

export type ProjectTranslationField = (typeof PROJECT_TRANSLATION_FIELDS)[number]
export type ProjectSourceFields = {
  title: string
  short_description: string
  description: string
  role: string
  scope: string[]
}
export type ProjectEnglishFields = ProjectSourceFields

const limits: Record<Exclude<ProjectTranslationField, 'scope'>, number> = {
  title: 180,
  short_description: 500,
  description: 5000,
  role: 120,
}
const MAX_SCOPE_ITEMS = 30
const MAX_SCOPE_ITEM_LENGTH = 180
export const MAX_TRANSLATION_REQUEST_BYTES = 64 * 1024
export const MAX_TRANSLATION_CHARACTERS = 12_000

export function normalizeProjectSourceFields(value: unknown): ProjectSourceFields | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  if (Object.keys(input).some((key) => !PROJECT_TRANSLATION_FIELDS.includes(key as ProjectTranslationField))) return undefined

  const output: ProjectSourceFields = { title: '', short_description: '', description: '', role: '', scope: [] }
  let totalCharacters = 0
  for (const field of PROJECT_TRANSLATION_FIELDS) {
    const item = input[field]
    if (field === 'scope') {
      if (item === undefined) continue
      if (!Array.isArray(item) || item.length > MAX_SCOPE_ITEMS || item.some((line) => typeof line !== 'string' || line.length > MAX_SCOPE_ITEM_LENGTH)) return undefined
      output.scope = item.map((line) => line.trim()).filter(Boolean)
      totalCharacters += output.scope.reduce((total, line) => total + line.length, 0)
      continue
    }
    if (item === undefined) continue
    if (typeof item !== 'string' || item.length > limits[field]) return undefined
    output[field] = item.trim()
    totalCharacters += output[field].length
  }
  if (!totalCharacters || totalCharacters > MAX_TRANSLATION_CHARACTERS) return undefined
  return output
}

export function mapTranslatedFields(source: ProjectSourceFields, translated: string[]): ProjectEnglishFields {
  const sourceFields = [...PROJECT_TRANSLATION_FIELDS]
  const expectedCount = sourceFields.reduce((count, field) => count + (field === 'scope' ? source.scope.length : source[field] ? 1 : 0), 0)
  if (translated.length !== expectedCount || translated.some((text) => typeof text !== 'string' || !text.trim())) {
    throw new Error('Translation provider returned an incomplete response.')
  }
  let index = 0
  const result: ProjectEnglishFields = { title: '', short_description: '', description: '', role: '', scope: [] }
  for (const field of sourceFields) {
    if (field === 'scope') {
      result.scope = source.scope.map(() => translated[index++].trim())
    } else if (source[field]) {
      result[field] = translated[index++].trim()
    }
  }
  return result
}

export function hasEnglishProjectContent(value: ProjectEnglishFields) {
  return Boolean(value.title || value.short_description || value.description || value.role || value.scope.some(Boolean))
}

export function mergeTranslatedProjectFields(current: ProjectEnglishFields, source: ProjectSourceFields, generated: ProjectEnglishFields): ProjectEnglishFields {
  return {
    title: source.title ? generated.title : current.title,
    short_description: source.short_description ? generated.short_description : current.short_description,
    description: source.description ? generated.description : current.description,
    role: source.role ? generated.role : current.role,
    scope: source.scope.length ? generated.scope : current.scope,
  }
}

export function translationIsConfigured(key: string | undefined) {
  return Boolean(key?.trim())
}
