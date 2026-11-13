import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nativeRequire = createRequire(import.meta.url)
const { NextResponse } = nativeRequire('next/server')

function loadTypeScript(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const loaded = { exports: {} }
  const localRequire = (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : nativeRequire(name)
  new Function('module', 'exports', 'require', compiled)(loaded, loaded.exports, localRequire)
  return loaded.exports
}

const cvUpload = loadTypeScript('lib/cv-upload.ts')
const { CvUploadError, MAX_CV_FILE_SIZE, uploadPublicCvPdf, validateCvFileMetadata } = cvUpload
let authResult = { access: { status: 'allowed' }, supabase: null }
let authCalls = 0
let uploadCalls = []
let uploadError = null
const mockBucket = {
  async upload(storagePath, bytes, options) {
    uploadCalls.push({ storagePath, bytes, options })
    return { error: uploadError }
  },
  getPublicUrl(storagePath) {
    return { data: { publicUrl: `https://assets.example.test/storage/public/public-documents/${storagePath}` } }
  },
}
const authModule = {
  async authorizeAdmin() { authCalls += 1; return authResult },
  adminAccessError(status) {
    const code = status === 'unauthenticated' ? 401 : 403
    return NextResponse.json({ error: 'Admin access denied.' }, { status: code })
  },
}
const configModule = { isSupabaseConfigured: true }
const originModule = loadTypeScript('lib/admin-origin.ts')
const routeModule = loadTypeScript('app/api/admin/cv/route.ts', {
  '@/lib/supabase/auth': authModule,
  '@/lib/supabase/config': configModule,
  '@/lib/admin-origin': originModule,
  '@/lib/cv-upload': cvUpload,
})
const { POST } = routeModule

function pdfFile({ bytes = '%PDF-1.7\nbody', type = 'application/pdf', size } = {}) {
  const contents = new TextEncoder().encode(bytes)
  return {
    type,
    size: size ?? contents.byteLength,
    async arrayBuffer() { return contents.buffer.slice(contents.byteOffset, contents.byteOffset + contents.byteLength) },
  }
}

function environment(values, callback) {
  const keys = ['NODE_ENV', 'NEXT_PUBLIC_SITE_URL']
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  for (const key of keys) delete process.env[key]
  Object.assign(process.env, values)
  try {
    const result = callback()
    if (result && typeof result.then === 'function') return result.finally(() => restore(keys, previous))
    restore(keys, previous)
    return result
  } catch (error) {
    restore(keys, previous)
    throw error
  }
}

function restore(keys, previous) {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key]
    else process.env[key] = previous[key]
  }
}

function requestWithFile(file, origin = 'https://geniastra.up.railway.app') {
  const formData = new FormData()
  formData.set('file', new File([new Uint8Array(file._bytes ?? new TextEncoder().encode('%PDF-1.7\nbody'))], 'untrusted-name.pdf', { type: file.type }))
  const request = new Request('http://internal:8080/api/admin/cv', {
    method: 'POST',
    headers: { origin },
    body: formData,
  })
  return request
}

function resetMocks() {
  authResult = { access: { status: 'allowed' }, supabase: { storage: { from: () => mockBucket } } }
  authCalls = 0
  uploadCalls = []
  uploadError = null
}

test('accepts a valid PDF and uploads to a safe versioned contact path', async () => {
  resetMocks()
  let pathFromUpload
  const bucket = {
    async upload(storagePath, bytes, options) {
      pathFromUpload = storagePath
      assert.equal(options.contentType, 'application/pdf')
      assert.equal(options.upsert, false)
      assert.ok(bytes.byteLength > 0)
      return { error: null }
    },
    getPublicUrl(storagePath) { return { data: { publicUrl: `https://cdn.test/${storagePath}` } } },
  }
  const result = await uploadPublicCvPdf(pdfFile(), bucket, () => '8a6b9412-2dbb-4a63-9979-11a62184c067')
  assert.equal(pathFromUpload, 'contact/cv-8a6b9412-2dbb-4a63-9979-11a62184c067.pdf')
  assert.equal(result.publicUrl, `https://cdn.test/${pathFromUpload}`)
})

test('rejects non-PDF MIME types', () => {
  assert.throws(() => validateCvFileMetadata(pdfFile({ type: 'text/plain' })), (error) => error instanceof CvUploadError && error.status === 415)
})

test('rejects files larger than five megabytes', () => {
  assert.equal(MAX_CV_FILE_SIZE, 5 * 1024 * 1024)
  assert.throws(() => validateCvFileMetadata(pdfFile({ size: MAX_CV_FILE_SIZE + 1 })), (error) => error instanceof CvUploadError && error.status === 413)
})

test('rejects PDF MIME without a PDF signature', async () => {
  await assert.rejects(uploadPublicCvPdf(pdfFile({ bytes: 'not a pdf' }), mockBucket, () => 'safe-id'), (error) => error instanceof CvUploadError && error.status === 400)
})

test('rejects unauthenticated or non-admin users before storage upload', async () => {
  resetMocks()
  for (const [status, expectedHttpStatus] of [['unauthenticated', 401], ['forbidden', 403]]) {
    authResult = { access: { status }, supabase: { storage: { from: () => mockBucket } } }
    const response = await environment({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://geniastra.up.railway.app' }, () => POST(requestWithFile(pdfFile())))
    assert.equal(response.status, expectedHttpStatus)
  }
  assert.equal(uploadCalls.length, 0)
})

test('rejects an invalid Origin with 403 before admin authorization', async () => {
  resetMocks()
  const response = await environment({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://geniastra.up.railway.app' }, () => POST(requestWithFile(pdfFile(), 'https://other.example.test')))
  assert.equal(response.status, 403)
  assert.equal(authCalls, 0)
})

test('accepts configured public Origin when Railway request URL is internal', async () => {
  resetMocks()
  const response = await environment({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://geniastra.up.railway.app' }, () => POST(requestWithFile(pdfFile())))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.match(body.publicUrl, /contact\/cv-/)
  assert.match(uploadCalls[0].storagePath, /^contact\/cv-[0-9a-f-]{36}\.pdf$/)
  assert.equal(uploadCalls.length, 1)
})

test('reports Storage failure without returning an upload URL', async () => {
  resetMocks()
  uploadError = new Error('storage rejected')
  const response = await environment({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://geniastra.up.railway.app' }, () => POST(requestWithFile(pdfFile())))
  assert.equal(response.status, 502)
  assert.equal(Object.hasOwn(await response.json(), 'publicUrl'), false)
})

test('editor applies returned URL only after successful upload and preserves prior URL on failure', () => {
  const editor = fs.readFileSync(path.join(root, 'app/admin/site-content-editor.tsx'), 'utf8')
  assert.match(editor, /if \(!response\.ok \|\| typeof data\.publicUrl !== 'string'\)/)
  assert.match(editor, /cvUrl: data\.publicUrl/)
  assert.match(editor, /setCvUploadMessage\(error instanceof Error \? error\.message : 'CV gagal diunggah\. URL sebelumnya tetap digunakan\.'\)/)
  assert.match(editor, /URL eksternal tetap dapat dimasukkan manual/)
  assert.match(editor, /type="file" accept="application\/pdf,\.pdf"/)
  assert.match(editor, /Simpan semua konten/)
})

test('saved CV setting is exposed by the localized public contact page', () => {
  const contentStore = fs.readFileSync(path.join(root, 'lib/site-content.ts'), 'utf8')
  const contactPage = fs.readFileSync(path.join(root, 'app/(localized)/[locale]/contact/page.tsx'), 'utf8')
  assert.match(contentStore, /cvUrl: settings\.cvUrl/)
  assert.match(contentStore, /cvUrl: content\.contact\.cvUrl/)
  assert.match(contactPage, /content\.cvUrl \? <a href=\{content\.cvUrl\}/)
  assert.match(contactPage, /View \/ download public CV/)
  assert.match(contactPage, /Lihat \/ unduh CV publik/)
})

test('migration is idempotent, limits writes to active admins and CV paths, and leaves portfolio-media untouched', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202611130001_admin_cv_documents.sql'), 'utf8')
  const sql = migration.replace(/^--.*$/gm, '')
  assert.match(migration, /on conflict \(id\) do update/)
  assert.match(migration, /'public-documents', 'public-documents', true, 5242880, array\['application\/pdf'\]/)
  assert.equal((migration.match(/public\.is_portfolio_admin\(\)/g) ?? []).length, 4)
  assert.equal((migration.match(/drop policy if exists/g) ?? []).length, 4)
  assert.doesNotMatch(sql, /portfolio-media/)
  assert.doesNotMatch(sql, /to anon\s+with check|for insert to anon|for update to anon|for delete to anon/i)
})
