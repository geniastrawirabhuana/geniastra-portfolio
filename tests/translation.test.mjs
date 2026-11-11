import test from 'node:test'
import assert from 'node:assert/strict'
import { DeepLProviderError, getDeepLEndpoint, translateProjectWithDeepL } from '../lib/translation/deepl-client.ts'
import { hasEnglishProjectContent, mapTranslatedFields, mergeTranslatedProjectFields, normalizeProjectSourceFields, translationIsConfigured } from '../lib/translation/project-fields.ts'
import { allowTranslationRequest, resetTranslationRateLimitForTests } from '../lib/translation/rate-limit.ts'

const source = { title: 'SIREJANG', short_description: 'Sistem informasi untuk remaja.', description: 'Aplikasi menggunakan Next.js dan Supabase untuk membantu pengguna.', role: 'Pengembang Web', scope: ['Membuat dashboard', 'Mengintegrasikan Supabase'] }
const generated = { title: 'SIREJANG', short_description: 'An information system for teenagers.', description: 'An application using Next.js and Supabase to support users.', role: 'Web Developer', scope: ['Build the dashboard', 'Integrate Supabase'] }

test('translation input allows only supported Indonesian fields and validates size', () => {
  assert.deepEqual(normalizeProjectSourceFields(source), source)
  assert.equal(normalizeProjectSourceFields({ ...source, slug: 'must-not-be-translated' }), undefined)
  assert.equal(normalizeProjectSourceFields({ title: 'x'.repeat(181) }), undefined)
  assert.equal(normalizeProjectSourceFields({ title: '', description: '' }), undefined)
  assert.equal(normalizeProjectSourceFields({ title: 'x', scope: ['y'.repeat(181)] }), undefined)
})

test('translation results map to fields in request order and preserve project-name terminology in mock result', () => {
  const result = mapTranslatedFields(source, [generated.title, generated.short_description, generated.description, generated.role, ...generated.scope])
  assert.deepEqual(result, generated)
  assert.throws(() => mapTranslatedFields(source, ['only one']), /incomplete/)
})

test('English overwrite detection and merge leave Indonesian values untouched and only replace source-backed fields', () => {
  const current = { title: 'Existing title', short_description: 'Existing summary', description: '', role: '', scope: ['Existing scope'] }
  assert.equal(hasEnglishProjectContent(current), true)
  const merged = mergeTranslatedProjectFields(current, { ...source, description: '', role: '', scope: [] }, generated)
  assert.deepEqual(merged, { ...current, title: generated.title, short_description: generated.short_description })
  assert.equal(source.title, 'SIREJANG')
})

test('missing key disables translation and DeepL endpoint selection is restricted to official HTTPS hosts', () => {
  assert.equal(translationIsConfigured(''), false)
  assert.equal(translationIsConfigured(' key '), true)
  assert.equal(getDeepLEndpoint('example:fx'), 'https://api-free.deepl.com/v2/translate')
  assert.equal(getDeepLEndpoint('pro-key'), 'https://api.deepl.com/v2/translate')
  assert.equal(getDeepLEndpoint('key', 'https://api-free.deepl.com/v2/translate'), 'https://api-free.deepl.com/v2/translate')
  assert.throws(() => getDeepLEndpoint('key', 'https://attacker.example/v2/translate'), /resmi DeepL/)
  assert.throws(() => getDeepLEndpoint('key', 'http://api.deepl.com/v2/translate'), /resmi DeepL/)
})

test('DeepL client sends only text with Indonesian-to-English context and maps provider response', async () => {
  let request
  const result = await translateProjectWithDeepL({
    source,
    apiKey: 'test-only-key',
    endpoint: 'https://api-free.deepl.com/v2/translate',
    fetcher: async (url, init) => {
      request = { url, init }
      return Response.json({ translations: [generated.title, generated.short_description, generated.description, generated.role, ...generated.scope].map((text) => ({ text })) })
    },
  })
  assert.deepEqual(result, generated)
  assert.equal(request.url, 'https://api-free.deepl.com/v2/translate')
  assert.equal(request.init.headers.Authorization, 'DeepL-Auth-Key test-only-key')
  const sent = JSON.parse(request.init.body)
  assert.deepEqual(sent.text, [source.title, source.short_description, source.description, source.role, ...source.scope])
  assert.equal(sent.source_lang, 'ID')
  assert.equal(sent.target_lang, 'EN-US')
  assert.match(sent.context, /Preserve official project names/)
})

test('provider unavailable, invalid credentials, malformed replies, and 429 responses fail clearly', async () => {
  await assert.rejects(translateProjectWithDeepL({ source, apiKey: '', endpoint: 'https://api.deepl.com/v2/translate' }), /not configured/)
  await assert.rejects(translateProjectWithDeepL({ source: { ...source, title: '', short_description: '', description: '', role: '', scope: [] }, apiKey: 'key', endpoint: 'https://api.deepl.com/v2/translate' }), /Tambahkan konten/)
  await assert.rejects(translateProjectWithDeepL({ source, apiKey: 'key', endpoint: 'https://api.deepl.com/v2/translate', fetcher: async () => new Response('', { status: 429 }) }), (error) => error instanceof DeepLProviderError && error.status === 429)
  await assert.rejects(translateProjectWithDeepL({ source, apiKey: 'key', endpoint: 'https://api.deepl.com/v2/translate', fetcher: async () => Response.json({ translations: [] }) }), /incomplete/)
})

test('per-user translation rate limit blocks the ninth request within one minute', () => {
  resetTranslationRateLimitForTests()
  for (let i = 0; i < 8; i++) assert.equal(allowTranslationRequest('admin-a', 10_000 + i), true)
  assert.equal(allowTranslationRequest('admin-a', 10_100), false)
  assert.equal(allowTranslationRequest('admin-b', 10_100), true)
  assert.equal(allowTranslationRequest('admin-a', 71_000), true)
  resetTranslationRateLimitForTests()
})
