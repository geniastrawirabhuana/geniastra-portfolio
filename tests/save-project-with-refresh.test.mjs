import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { adminProjectSnapshot } from '../lib/supabase/admin-project-snapshot.ts'
import { normalizeAdminProject } from '../lib/admin-project-form.ts'
import { saveProjectWithRefresh } from '../lib/supabase/save-project-with-refresh.ts'

const createRoute = await readFile(new URL('../app/api/admin/projects/route.ts', import.meta.url), 'utf8')
const updateRoute = await readFile(new URL('../app/api/admin/projects/[slug]/route.ts', import.meta.url), 'utf8')

test('create: successful RPC reloads the saved admin record after public revalidation', async () => {
  const calls = []
  const result = await saveProjectWithRefresh({
    save: async () => { calls.push('save'); return { data: 'project-1', error: null } },
    revalidate: () => calls.push('revalidate'),
    reload: async (id) => { calls.push(`reload:${id}`); return { id } },
  })

  assert.deepEqual(calls, ['save', 'revalidate', 'reload:project-1'])
  assert.deepEqual(result, { saved: true, id: 'project-1', record: { id: 'project-1' }, cacheRevalidated: true })
})

test('create: successful RPC and failed dashboard reload still revalidates and stays successful', async () => {
  const calls = []
  const result = await saveProjectWithRefresh({
    save: async () => { calls.push('save'); return { data: 'project-2', error: null } },
    revalidate: () => calls.push('revalidate'),
    reload: async () => { calls.push('reload'); throw new Error('read failed') },
  })

  assert.deepEqual(calls, ['save', 'revalidate', 'reload'])
  assert.equal(result.saved, true)
  assert.equal(result.id, 'project-2')
  assert.equal(result.cacheRevalidated, true)
  assert.match(result.warning, /Data dashboard gagal dimuat ulang/)
})

test('update/publish: failed dashboard reload does not undo the saved publication or cache revalidation', async () => {
  const calls = []
  const result = await saveProjectWithRefresh({
    save: async () => { calls.push('save-published'); return { data: 'published-project', error: null } },
    revalidate: () => calls.push('revalidate-old-and-new-slugs'),
    reload: async () => { calls.push('reload'); return null },
  })

  assert.deepEqual(calls, ['save-published', 'revalidate-old-and-new-slugs', 'reload'])
  assert.equal(result.saved, true)
  assert.equal(result.id, 'published-project')
  assert.match(result.warning, /jangan ulangi publikasi/)
})

test('failed RPC never calls public cache revalidation', async () => {
  let revalidated = false
  const result = await saveProjectWithRefresh({
    save: async () => ({ data: null, error: { message: 'constraint failed' } }),
    revalidate: () => { revalidated = true },
    reload: async () => ({ unexpected: true }),
  })

  assert.deepEqual(result, { saved: false, error: 'constraint failed' })
  assert.equal(revalidated, false)
})

test('both create and update endpoints use the persist-then-revalidate workflow and return a saved snapshot on reload failure', () => {
  for (const source of [createRoute, updateRoute]) {
    assert.match(source, /saveProjectWithRefresh\(/)
    assert.match(source, /adminProjectSnapshot\(bundle, result\.id\)/)
    assert.match(source, /result\.warning/)
  }
})

test('fallback admin response preserves published status, bilingual content, and media after reload failure', () => {
  const projectId = '123e4567-e89b-42d3-a456-426614174000'
  const bundle = {
    project: { slug: 'saved-project', category: 'website', status: 'published', featured: false, display_order: 3, project_url: null, github_url: null, start_date: null, end_date: null },
    translations: [
      { locale: 'id', title: 'Proyek ID', short_description: 'Ringkasan ID', description: 'Deskripsi ID', role: '', period_label: '', mark: '', scope: [], seo_title: null, seo_description: null },
      { locale: 'en', title: 'Project EN', short_description: 'Summary EN', description: 'Description EN', role: '', period_label: '', mark: '', scope: [], seo_title: null, seo_description: null },
    ],
    media: [{ storage_path: `projects/${projectId}/123e4567-e89b-42d3-a456-426614174001.webp`, media_type: 'cover', alt_text_id: 'Sampul', alt_text_en: 'Cover', caption_id: null, caption_en: null, display_order: 0 }],
  }

  const project = normalizeAdminProject(adminProjectSnapshot(bundle, projectId))
  assert.equal(project.status, 'published')
  assert.equal(project.featured, false)
  assert.equal(project.translations.id.title, 'Proyek ID')
  assert.equal(project.translations.en.title, 'Project EN')
  assert.equal(project.media[0].storage_path, bundle.media[0].storage_path)
})

test('admin distinguishes a saved publication from an admin list refresh failure', async () => {
  const panel = await readFile(new URL('../app/admin/admin-panel.tsx', import.meta.url), 'utf8')
  assert.match(panel, /const savedMessage = payload\.status === 'published' \? 'Proyek berhasil diterbitkan\.'/)
  assert.match(panel, /Publikasi sudah tersimpan; jangan ulangi publikasi\./)
})
