import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { emptyAdminProject, normalizeAdminProject } from '../lib/admin-project-form.ts'
import { normalizeProjectBundle } from '../lib/supabase/project-validation.ts'

const panelSource = await readFile(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8')
const translation = (title, extras = {}) => ({ title, short_description: `${title} ringkas`, description: `${title} lengkap`, role: '', period_label: '', mark: '', scope: [], seo_title: null, seo_description: null, ...extras })
const publishId = '123e4567-e89b-42d3-a456-426614174000'
const validPublish = () => ({ slug: 'form-test', category: 'website', status: 'published', id: publishId, translations: { id: translation('Proyek'), en: translation('Project') }, media: [{ storage_path: `projects/${publishId}/123e4567-e89b-42d3-a456-426614174001.webp`, media_type: 'cover' }] })

test('new project starts with editable empty optional values in both locales', () => {
  const project = emptyAdminProject()
  assert.equal(project.status, 'draft')
  assert.equal(project.translations.id.mark, '')
  assert.equal(project.translations.en.mark, '')
  assert.equal(project.translations.id.seo_title, '')
  assert.equal(project.project_url, '')
})

test('existing nullable tagline and metadata normalize to strings without changing saved content', () => {
  const project = normalizeAdminProject({
    id: 'saved-id', slug: 'saved-draft', status: 'draft', mark: 'ignored-extra', project_url: null, github_url: null,
    translations: { id: translation('Judul tersimpan', { mark: null, seo_title: null }), en: translation('Saved title', { mark: null }) },
    media: [{ storage_path: 'projects/saved/cover.webp', media_type: 'cover', alt_text_id: null, alt_text_en: null, caption_id: null, caption_en: null, display_order: 0 }],
  })
  assert.equal(project.translations.id.title, 'Judul tersimpan')
  assert.equal(project.translations.en.title, 'Saved title')
  assert.equal(project.translations.id.mark, '')
  assert.equal(project.translations.en.mark, '')
  assert.equal(project.project_url, '')
  assert.equal(project.media[0].caption_id, '')
})

test('missing English translation and optional fields are safe, and switching locales retains both drafts', () => {
  const project = normalizeAdminProject({ slug: 'id-only', translations: { id: translation('Masih ada') } })
  assert.equal(project.translations.en.title, '')
  assert.equal(project.translations.en.description, '')
  assert.equal(project.translations.id.title, 'Masih ada')
  assert.match(panelSource, /\(\['id', 'en'\] as const\)\.map\(\(locale\)/)
  assert.match(panelSource, /project\.translations\?\.\[locale\]\?\.mark \?\? ""/)
})

test('editing and saving a draft preserves translation and media data while empty nullable fields become database nulls', () => {
  const original = normalizeAdminProject({
    id: '123e4567-e89b-42d3-a456-426614174000', slug: 'saved-draft', status: 'draft', project_url: null,
    translations: { id: translation('Tetap tersimpan', { mark: null }), en: translation('Still saved') },
    media: [{ storage_path: 'projects/123e4567-e89b-42d3-a456-426614174000/123e4567-e89b-42d3-a456-426614174001.webp', media_type: 'cover', alt_text_id: 'Sampul', alt_text_en: '', caption_id: null, caption_en: null, display_order: 0 }],
  })
  const payload = { ...original, status: 'draft', translations: { id: original.translations.id, en: original.translations.en } }
  const saved = normalizeProjectBundle(payload)
  assert.ok(saved)
  assert.equal(saved.project.project_url, null)
  assert.equal(saved.translations.find((item) => item.locale === 'id')?.mark, '')
  assert.equal(saved.translations.find((item) => item.locale === 'id')?.seo_title, null)
  assert.equal(saved.media[0].storage_path, 'projects/123e4567-e89b-42d3-a456-426614174000/123e4567-e89b-42d3-a456-426614174001.webp')
  assert.match(panelSource, /const savedProject = normalizeAdminProject\(data\.project\)/)
})

test('publishing accepts both locales with required content and rejects genuinely missing required text', () => {
  assert.equal(normalizeProjectBundle(validPublish())?.project.status, 'published')
  assert.equal(normalizeProjectBundle({ ...validPublish(), translations: { ...validPublish().translations, en: translation('') } }), undefined)
  assert.match(panelSource, /intent === 'published' \? 'published'/)
  assert.match(panelSource, /const status = hasQueuedImages \? 'draft' : requestedStatus/)
})
