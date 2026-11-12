import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'lib/admin-origin.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const loaded = { exports: {} }
new Function('module', 'exports', compiled)(loaded, loaded.exports)
const { isAllowedAdminOrigin } = loaded.exports

const production = { NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://geniastra.up.railway.app' }

test('accepts the configured HTTPS Railway origin', () => {
  assert.equal(isAllowedAdminOrigin('https://geniastra.up.railway.app', 'https://internal:8080/api/admin/session', production), true)
})

test('rejects a different origin', () => {
  assert.equal(isAllowedAdminOrigin('https://attacker.example', 'https://internal:8080/api/admin/session', production), false)
})

test('rejects a missing origin', () => {
  assert.equal(isAllowedAdminOrigin(null, 'https://internal:8080/api/admin/session', production), false)
})

test('does not use an internal request URL when configured public origin matches', () => {
  assert.equal(isAllowedAdminOrigin('https://geniastra.up.railway.app', 'http://localhost:8080/api/admin/session', production), true)
})

test('rejects missing or invalid production configuration', () => {
  for (const environment of [
    { NODE_ENV: 'production' },
    { NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'not a URL' },
    { NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'http://geniastra.up.railway.app' },
    { NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://localhost:8080' },
  ]) {
    assert.equal(isAllowedAdminOrigin('https://geniastra.up.railway.app', 'http://localhost:8080/api/admin/session', environment), false)
  }
})

test('accepts same-origin localhost in development', () => {
  assert.equal(isAllowedAdminOrigin('http://localhost:3000', 'http://localhost:3000/api/admin/session', { NODE_ENV: 'development' }), true)
})

test('rejects a cross-origin request in development', () => {
  assert.equal(isAllowedAdminOrigin('http://attacker.example', 'http://localhost:3000/api/admin/session', { NODE_ENV: 'development' }), false)
})
