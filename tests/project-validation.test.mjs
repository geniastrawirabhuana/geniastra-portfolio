import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProjectBundle, bundleToJson } from '../lib/supabase/project-validation.ts'

const translation = (title) => ({ title, short_description: `${title} summary`, description: `${title} description`, role: '', period_label: '', mark: '', scope: [] })
const projectId = '123e4567-e89b-42d3-a456-426614174000'
const cover = { storage_path: `projects/${projectId}/123e4567-e89b-42d3-a456-426614174001.webp`, media_type: 'cover' }
const draft = (overrides = {}) => ({ slug: 'my-project', category: 'website', status: 'draft', translations: { id: translation('Proyek'), en: translation('Project') }, ...overrides })

test('project bundle accepts a valid bilingual draft and emits RPC argument names', () => {
  const bundle = normalizeProjectBundle(draft())
  assert.ok(bundle)
  assert.equal(bundle.project.status, 'draft')
  assert.deepEqual(Object.keys(bundleToJson(bundle)), ['p_project', 'p_translations', 'p_media'])
})

test('project publication requires bilingual content and a saved cover image', () => {
  assert.equal(normalizeProjectBundle(draft({ status: 'published', id: projectId, media: [cover], translations: { id: translation('Proyek'), en: translation('') } })), undefined, 'a missing English translation is rejected')
  assert.equal(normalizeProjectBundle(draft({ status: 'published' })), undefined, 'a missing cover is rejected')
  const ready = normalizeProjectBundle(draft({ status: 'published', id: projectId, media: [cover] }))
  assert.equal(ready?.project.status, 'published')
})

test('invalid slugs and categories are rejected', () => {
  assert.equal(normalizeProjectBundle(draft({ slug: '../admin' })), undefined)
  assert.equal(normalizeProjectBundle(draft({ category: 'unknown' })), undefined)
})

test('media requires a unique UUID-based project storage path and at most one cover', () => {
  const id = projectId
  const image = cover
  assert.ok(normalizeProjectBundle(draft({ id, media: [image] })))
  assert.equal(normalizeProjectBundle(draft({ id, media: [{ ...image, storage_path: 'projects/my-project/image.png' }] })), undefined)
  assert.equal(normalizeProjectBundle(draft({ id, media: [image, { ...image, storage_path: `projects/${id}/123e4567-e89b-42d3-a456-426614174002.png` }] })), undefined)
})

test('external project links only retain HTTP(S) URLs', () => {
  const bundle = normalizeProjectBundle(draft({ project_url: 'javascript:alert(1)', github_url: 'https://github.com/example/project' }))
  assert.equal(bundle.project.project_url, null)
  assert.equal(bundle.project.github_url, 'https://github.com/example/project')
})
