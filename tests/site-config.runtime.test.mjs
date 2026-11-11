import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const nativeRequire = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadTypeScript(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const loadedModule = { exports: {} }
  const localRequire = (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : nativeRequire(name)
  new Function('module', 'exports', 'require', compiled)(loadedModule, loadedModule.exports, localRequire)
  return loadedModule.exports
}

const configModule = loadTypeScript('lib/site-config.ts')
const { getSiteUrl } = configModule
const portfolio = loadTypeScript('content/portfolio.ts')
const projects = { getPortfolioSlugs: async () => portfolio.projects.map((project) => project.slug) }
const metadata = loadTypeScript('lib/metadata.ts', { './site-config': configModule })
const sitemap = loadTypeScript('app/sitemap.ts', {
  '@/lib/site-config': configModule,
  '@/lib/projects': projects,
})
const robots = loadTypeScript('app/robots.ts', { '@/lib/site-config': configModule })

const environmentKeys = [
  'NEXT_PUBLIC_SITE_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
  'VERCEL',
  'VERCEL_ENV',
  'NODE_ENV',
]

function withEnvironment(environment, callback) {
  const original = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]))
  for (const key of environmentKeys) delete process.env[key]
  Object.assign(process.env, environment)

  const restore = () => {
    for (const key of environmentKeys) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
  }

  try {
    const result = callback()
    if (result && typeof result.then === 'function') return result.finally(restore)
    restore()
    return result
  } catch (error) {
    restore()
    throw error
  }
}

test('A: development falls back to localhost without a public URL', () => {
  withEnvironment({ NODE_ENV: 'development' }, () => {
    assert.equal(getSiteUrl().origin, 'http://localhost:3000')
  })
})

test('B: local production build returns undefined without a public URL', () => {
  withEnvironment({ NODE_ENV: 'production' }, () => {
    assert.equal(getSiteUrl(), undefined)
  })
})

test('C: Vercel Preview prefers the stable project production URL', () => {
  withEnvironment({
    NODE_ENV: 'production',
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_PROJECT_PRODUCTION_URL: 'geniastra.id',
    VERCEL_URL: 'preview-123.vercel.app',
  }, () => {
    assert.equal(getSiteUrl().origin, 'https://geniastra.id')
  })
})

test('D: Vercel Production accepts a valid HTTPS URL and normalizes to origin', () => {
  withEnvironment({
    NODE_ENV: 'production',
    VERCEL: '1',
    VERCEL_ENV: 'production',
    NEXT_PUBLIC_SITE_URL: 'https://geniastra.id/path?ref=build#top',
    VERCEL_PROJECT_PRODUCTION_URL: 'secondary.geniastra.id',
    VERCEL_URL: 'deployment.vercel.app',
  }, () => {
    assert.equal(getSiteUrl().origin, 'https://geniastra.id')
  })
})

test('E: Vercel Production rejects a missing public URL', () => {
  withEnvironment({ NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production' }, () => {
    assert.throws(getSiteUrl, /Set NEXT_PUBLIC_SITE_URL or a Vercel production URL/)
  })
})

test('F: Vercel Production rejects HTTP URLs', () => {
  withEnvironment({
    NODE_ENV: 'production',
    VERCEL: '1',
    VERCEL_ENV: 'production',
    NEXT_PUBLIC_SITE_URL: 'http://portfolio.example.org',
  }, () => {
    assert.throws(getSiteUrl, /must use HTTPS/)
  })
})

test('production rejects malformed, unsupported, localhost, and placeholder URLs', () => {
  for (const url of ['https://bad host', 'ftp://portfolio.example.org', 'https://localhost:3000', 'https://127.0.0.2', 'https://www.example.com', 'https://intranet', 'https://user:pass@geniastra.id']) {
    withEnvironment({
      NODE_ENV: 'production',
      VERCEL: '1',
      VERCEL_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: url,
    }, () => assert.throws(getSiteUrl, undefined, url))
  }
})

test('public URL produces absolute canonical, hreflang, and Open Graph metadata', () => {
  withEnvironment({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://geniastra.id' }, () => {
    const result = metadata.localizedMetadata('id', '/about', 'About', 'Description')
    assert.equal(result.alternates.canonical, 'https://geniastra.id/id/about')
    assert.deepEqual(result.alternates.languages, {
      'id-ID': 'https://geniastra.id/id/about',
      en: 'https://geniastra.id/en/about',
      'x-default': 'https://geniastra.id/id/about',
    })
    assert.equal(result.openGraph.url, 'https://geniastra.id/id/about')
    assert.deepEqual(result.openGraph.images[0].url, 'https://geniastra.id/og-image.png')
  })
})

test('missing local production URL omits URL metadata', () => {
  withEnvironment({ NODE_ENV: 'production' }, () => {
    const result = metadata.localizedMetadata('id', '/about', 'About', 'Description')
    assert.equal(result.alternates, undefined)
    assert.equal(result.openGraph.url, undefined)
    assert.equal(result.openGraph.images, undefined)
    assert.equal(result.twitter.images, undefined)
  })
})

test('public URL produces localized sitemap entries and robots reference', async () => {
  await withEnvironment({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://geniastra.id' }, async () => {
    const entries = await sitemap.default()
    assert.equal(entries.length, (portfolio.projects.length + 5) * 2)
    assert.equal(entries[0].url, 'https://geniastra.id/id')
    assert.deepEqual(entries[0].alternates.languages, {
      'id-ID': 'https://geniastra.id/id',
      en: 'https://geniastra.id/en',
      'x-default': 'https://geniastra.id/id',
    })
    assert.equal(robots.default().sitemap, 'https://geniastra.id/sitemap.xml')
  })
})

test('missing local production URL yields an empty sitemap and no robots sitemap URL', async () => {
  await withEnvironment({ NODE_ENV: 'production' }, async () => {
    assert.deepEqual(await sitemap.default(), [])
    assert.equal(robots.default().sitemap, undefined)
  })
})
