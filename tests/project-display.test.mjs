import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { isPortfolioProjectReady, mapPublicProject, projectSeoDescription } from '../lib/project-display.ts'
import { publicProjectRevalidationPaths } from '../lib/public-project-paths.ts'
import { normalizeProjectBundle } from '../lib/supabase/project-validation.ts'

const homeSource = await readFile(new URL('../app/(localized)/[locale]/page.tsx', import.meta.url), 'utf8')
const listingSource = await readFile(new URL('../app/(localized)/[locale]/projects/page.tsx', import.meta.url), 'utf8')
const detailSource = await readFile(new URL('../app/(localized)/[locale]/projects/[slug]/page.tsx', import.meta.url), 'utf8')
const projectsSource = await readFile(new URL('../lib/projects.ts', import.meta.url), 'utf8')
const sitemapSource = await readFile(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
const createRoute = await readFile(new URL('../app/api/admin/projects/route.ts', import.meta.url), 'utf8')
const editRoute = await readFile(new URL('../app/api/admin/projects/[slug]/route.ts', import.meta.url), 'utf8')
const uploadRoute = await readFile(new URL('../app/api/admin/upload/route.ts', import.meta.url), 'utf8')
const revalidationSource = await readFile(new URL('../lib/revalidate-public-projects.ts', import.meta.url), 'utf8')

const projectId = '123e4567-e89b-42d3-a456-426614174000'
const translations = [
  { locale: 'id', title: 'Proyek Indonesia', short_description: 'Ringkasan ID', description: 'Deskripsi ID lengkap', role: 'Pengembang', period_label: '2026', mark: 'PI', scope: ['Ruang lingkup ID'], seo_title: null, seo_description: null },
  { locale: 'en', title: 'English Project', short_description: 'English summary', description: 'Full English description', role: 'Developer', period_label: '2026', mark: 'EP', scope: ['English scope'], seo_title: 'SEO EN', seo_description: 'SEO description EN' },
]
const cover = { storage_path: `projects/${projectId}/123e4567-e89b-42d3-a456-426614174001.webp`, media_type: 'cover', alt_text_id: 'Sampul ID', alt_text_en: 'Cover EN', caption_id: null, caption_en: null, display_order: 0, created_at: '2026-01-01' }
const projectRow = (overrides = {}) => ({ id: projectId, slug: 'auto-project', category: 'website', status: 'published', featured: false, display_order: 4, project_url: null, github_url: null, start_date: null, end_date: null, project_translations: translations, project_media: [cover], ...overrides })
const publicUrl = (path) => `https://storage.example/public/${path}`

test('published featured projects are queried from Supabase, ordered, localized, and shown on the homepage', () => {
  const featured = mapPublicProject(projectRow({ featured: true, display_order: 2 }), 'id', publicUrl)
  assert.equal(featured.featured, true)
  assert.equal(featured.displayOrder, 2)
  assert.equal(featured.title, 'Proyek Indonesia')
  assert.equal(featured.cover, publicUrl(cover.storage_path))
  assert.match(projectsSource, /\.eq\('status', 'published'\)/)
  assert.match(projectsSource, /\.order\('display_order', \{ ascending: true \}\)/)
  assert.doesNotMatch(projectsSource, /order\('featured'/)
  assert.match(homeSource, /getPortfolioProjects\(locale\)\)\.filter\(\(project\) => project\.featured\)/)
  assert.match(homeSource, /project\.cover \? <div/)
})

test('all published projects, including non-featured entries, feed both localized listing routes', () => {
  const nonFeatured = mapPublicProject(projectRow({ featured: false }), 'en', publicUrl)
  assert.equal(nonFeatured.featured, false)
  assert.equal(nonFeatured.title, 'English Project')
  assert.equal(nonFeatured.shortDescription.en, 'English summary')
  assert.equal(nonFeatured.description.en, 'Full English description')
  assert.match(listingSource, /getPortfolioProjects\(locale\)/)
  assert.match(listingSource, /p\.shortDescription\[locale\]/)
  assert.match(homeSource, /project\.shortDescription\[locale\]/)
  assert.match(listingSource, /localePath\(locale,`\/projects\/\$\{p\.slug\}`\)/)
  assert.doesNotMatch(listingSource, /\.filter\([^)]*featured/)
})

test('localized project detail uses full Indonesian and English descriptions while cards keep summaries', () => {
  const indonesian = mapPublicProject(projectRow(), 'id', publicUrl)
  const english = mapPublicProject(projectRow(), 'en', publicUrl)
  assert.equal(indonesian.shortDescription.id, 'Ringkasan ID')
  assert.equal(indonesian.description.id, 'Deskripsi ID lengkap')
  assert.equal(english.shortDescription.en, 'English summary')
  assert.equal(english.description.en, 'Full English description')
  assert.match(detailSource, /project\.description\[locale\]/)
  assert.match(detailSource, /projectSeoDescription\(project, locale\)/)
})

test('SEO prefers an explicit description, then the short description, then a bounded full-description excerpt', () => {
  const project = mapPublicProject(projectRow(), 'en', publicUrl)
  assert.equal(projectSeoDescription(project, 'en'), 'SEO description EN')
  const projectId = mapPublicProject(projectRow(), 'id', publicUrl)
  assert.equal(projectSeoDescription(projectId, 'id'), 'Ringkasan ID')
  const withoutShortOrSeo = {
    ...project,
    shortDescription: { id: '', en: '' },
    seoDescription: undefined,
    description: { id: '  Detail   panjang  '.repeat(20), en: 'English detail' },
  }
  const excerpt = projectSeoDescription(withoutShortOrSeo, 'id')
  assert.ok(excerpt.length <= 160)
  assert.ok(excerpt.startsWith('Detail panjang'))
})

test('cover and gallery URLs use Supabase assets and gallery order is deterministic', () => {
  const galleryLater = { ...cover, storage_path: `projects/${projectId}/123e4567-e89b-42d3-a456-426614174003.webp`, media_type: 'gallery', display_order: 2, alt_text_en: 'Second screenshot' }
  const galleryFirst = { ...cover, storage_path: `projects/${projectId}/123e4567-e89b-42d3-a456-426614174002.webp`, media_type: 'gallery', display_order: 1, alt_text_en: 'First screenshot' }
  const result = mapPublicProject(projectRow({ project_media: [galleryLater, cover, galleryFirst] }), 'en', publicUrl)
  assert.equal(result.cover, publicUrl(cover.storage_path))
  assert.deepEqual(result.galleryItems.map((item) => item.alt), ['First screenshot', 'Second screenshot'])
  assert.deepEqual(result.gallery, result.galleryItems.map((item) => item.url))
})

test('draft, missing translation, incomplete content, and missing cover are not publicly addressable', () => {
  assert.equal(mapPublicProject(projectRow({ status: 'draft' }), 'id', publicUrl), undefined)
  assert.equal(mapPublicProject(projectRow({ project_media: [] }), 'id', publicUrl), undefined)
  assert.equal(mapPublicProject(projectRow({ project_translations: translations.slice(0, 1) }), 'id', publicUrl), undefined)
  assert.equal(mapPublicProject(projectRow({ project_translations: translations.slice(0, 1) }), 'en', publicUrl), undefined)
  assert.equal(mapPublicProject(projectRow({ project_translations: [{ ...translations[0], description: '' }, translations[1]] }), 'id', publicUrl), undefined)
  assert.match(projectsSource, /if \(!result\) return staticFallback\(\)\.find\(\(project\) => project\.slug === slug\)/)
  assert.match(detailSource, /if \(!project\) notFound\(\)/)
  assert.doesNotMatch(detailSource, /generateStaticParams/)
  assert.match(detailSource, /export const dynamicParams = true/)
})

test('only ready published projects enter the sitemap and publication requires a saved cover', () => {
  assert.equal(isPortfolioProjectReady(projectRow()), true)
  assert.equal(isPortfolioProjectReady(projectRow({ project_media: [] })), false)
  assert.equal(isPortfolioProjectReady(projectRow({ status: 'draft' })), false)
  assert.match(projectsSource, /rows\.filter\(isPortfolioProjectReady\)\.map\(\(row\) => row\.slug\)/)
  assert.match(sitemapSource, /getPortfolioSlugs\(\)/)
  const publishBundle = { slug: 'ready-project', category: 'website', status: 'published', id: projectId, translations: { id: translations[0], en: translations[1] }, media: [cover] }
  const noCover = normalizeProjectBundle({ ...publishBundle, media: [] })
  assert.equal(normalizeProjectBundle(publishBundle)?.project.status, 'published')
  assert.equal(noCover, undefined)
})

test('admin publish, unpublish, slug updates, and published image changes expire shared cache and routes', () => {
  assert.deepEqual(publicProjectRevalidationPaths('old-project', 'new-project', 'old-project'), [
    '/sitemap.xml', '/id', '/id/projects', '/id/projects/old-project', '/id/projects/new-project',
    '/en', '/en/projects', '/en/projects/old-project', '/en/projects/new-project',
  ])
  assert.match(revalidationSource, /revalidateTag\('public-projects', \{ expire: 0 \}\)/)
  assert.match(revalidationSource, /publicProjectRevalidationPaths\(\.\.\.slugs\)/)
  assert.match(createRoute, /revalidatePublicProjects\(bundle\.project\.slug\)/)
  assert.match(editRoute, /revalidatePublicProjects\(oldSlug, bundle\.project\.slug\)/)
  assert.match(editRoute, /revalidatePublicProjects\(slug\)/)
  assert.match(uploadRoute, /project\.status === 'published'\) revalidatePublicProjects\(project\.slug\)/)
})
