import { createHash } from 'node:crypto'
import { readFile, access } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { resolve, relative, isAbsolute, extname } from 'node:path'

function loadLocalEnv() {
  try {
    const content = readFileSync('.env.local', 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!match || process.env[match[1]]) continue
      const value = match[2].replace(/^['"]|['"]$/g, '').replace(/\s+#.*$/, '')
      process.env[match[1]] = value
    }
  } catch {}
}
loadLocalEnv()

const apply = process.argv.includes('--apply')
const uuidFrom = (value) => {
  const hex = createHash('sha256').update(value).digest('hex').slice(0, 32).split('')
  hex[12] = '5'; hex[16] = (parseInt(hex[16], 16) & 0x3 | 0x8).toString(16)
  const raw = hex.join('')
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
}
const exists = async (path) => access(path).then(() => true).catch(() => false)
const projectRows = []
const mediaRows = []
const siteContentRows = []
const settings = []
const educationRows = []
const experienceRows = []
const experienceTranslationRows = []
const filesToUpload = []
const errors = []
const seenSlugs = new Set()
const seenStoragePaths = new Set()

const [{ projects: builtInProjects, experience }, { messages }] = await Promise.all([
  import('../content/portfolio.ts'), import('../messages/index.ts'),
])
const managedFile = 'content/managed-projects.json'
const managed = await exists(managedFile) ? JSON.parse(await readFile(managedFile, 'utf8')).projects ?? [] : []
const config = (name, fallback = '') => process.env[name]?.trim() || fallback
const defaults = {
  siteName: config('NEXT_PUBLIC_SITE_NAME', 'GENIASTRA'), fullName: config('NEXT_PUBLIC_FULL_NAME', 'GENIASTRA'),
  location: { id: messages.id.location, en: messages.en.location },
  home: Object.fromEntries(['heroEyebrow', 'heroTitle', 'heroText', 'aboutEyebrow', 'aboutTitle', 'aboutText', 'strengthsList'].map((key) => [key, { id: messages.id[key], en: messages.en[key] }])),
  about: { paragraphs: { id: [messages.id.aboutText, 'Latar belakang saya berada di bidang Teknologi Informasi, dengan ketertarikan pada bagaimana teknologi dapat membantu orang bekerja dan berkomunikasi dengan lebih baik.', 'Saya cepat belajar, mampu bekerja dalam tim, dan berkomitmen untuk terus meningkatkan kompetensi di bidang Teknologi Informasi.'], en: [messages.en.aboutText, 'My background is in Information Technology, with an interest in how technology can help people work and communicate better.', 'I learn quickly, work well in a team, and am committed to continuously improving my skills in Information Technology.'] } },
  contact: { title: { id: messages.id.contactTitle, en: messages.en.contactTitle }, text: { id: messages.id.contactText, en: messages.en.contactText }, email: config('NEXT_PUBLIC_CONTACT_EMAIL'), github: config('NEXT_PUBLIC_GITHUB_URL'), linkedin: config('NEXT_PUBLIC_LINKEDIN_URL'), cvUrl: config('NEXT_PUBLIC_CV_URL') },
  experience,
}
const siteContentPath = 'content/site-content.json'
const siteContent = await exists(siteContentPath) ? JSON.parse(await readFile(siteContentPath, 'utf8')) : defaults
const settingsSource = {
  siteName: siteContent.siteName || defaults.siteName, fullName: siteContent.fullName || defaults.fullName,
  email: siteContent.contact?.email ?? defaults.contact.email, github: siteContent.contact?.github ?? defaults.contact.github,
  linkedin: siteContent.contact?.linkedin ?? defaults.contact.linkedin, cvUrl: siteContent.contact?.cvUrl ?? defaults.contact.cvUrl,
}
for (const [setting_key, value] of Object.entries(settingsSource)) settings.push({ setting_key, value: String(value ?? '') })
const localizedPairs = [
  ['location', siteContent.location],
  ...Object.entries(siteContent.home ?? {}).filter(([key]) => key !== 'strengthsList').map(([key, value]) => [`home.${key}`, value]),
  ['home.strengthsList', { id: (siteContent.home?.strengthsList?.id ?? []).join('\n'), en: (siteContent.home?.strengthsList?.en ?? []).join('\n') }],
  ['about.paragraphs', { id: (siteContent.about?.paragraphs?.id ?? []).join('\n'), en: (siteContent.about?.paragraphs?.en ?? []).join('\n') }],
  ['contact.title', siteContent.contact?.title], ['contact.text', siteContent.contact?.text],
]
for (const [content_key, pair] of localizedPairs) for (const locale of ['id', 'en']) siteContentRows.push({ content_key, locale, value: String(pair?.[locale] ?? '') })

async function normalizedProject(project, source) {
  if (!project || typeof project.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug)) {
    errors.push(`Invalid project slug in ${source} source.`)
    return
  }
  if (seenSlugs.has(project.slug)) {
    errors.push(`Duplicate project slug in import sources: ${project.slug}`)
    return
  }
  seenSlugs.add(project.slug)
  const id = uuidFrom(`geniastra-project:${project.slug}`)
  projectRows.push({ id, slug: project.slug, category: project.category ?? 'other', status: 'published', featured: Boolean(project.featured ?? (source === 'builtin' && builtInProjects.slice(-3).some((item) => item.slug === project.slug))), display_order: project.displayOrder ?? project.display_order ?? projectRows.length + 1, project_url: project.projectUrl ?? project.project_url ?? null, github_url: project.githubUrl ?? project.github_url ?? null, start_date: project.start_date ?? null, end_date: project.end_date ?? null })
  for (const locale of ['id', 'en']) {
    const titleValue = typeof project.title === 'string' ? project.title : project.title?.[locale] ?? ''
    const role = typeof project.role === 'string' ? { id: project.role, en: project.role } : project.role ?? {}
    const period = typeof project.period === 'string' ? { id: project.period, en: project.period } : project.period ?? {}
    const description = typeof project.description === 'string' ? { id: project.description, en: project.description } : project.description ?? {}
    const scope = project.scope ?? {}
    const mark = typeof project.mark === 'string' ? { id: project.mark, en: project.mark } : project.mark ?? {}
    const seo = project.seo ?? {}
    projectRows.translations ??= []
    projectRows.translations.push({ project_id: id, locale, title: titleValue, short_description: description[locale] ?? '', description: description[locale] ?? '', role: role[locale] ?? '', period_label: period[locale] ?? '', mark: mark[locale] ?? '', scope: Array.isArray(scope[locale]) ? scope[locale] : [], seo_title: seo.title?.[locale] ?? null, seo_description: seo.description?.[locale] ?? null })
  }
  const sourceImages = []
  if (project.cover) sourceImages.push({ sourcePath: project.cover, media_type: 'cover', display_order: 0 })
  for (const [index, image] of (project.gallery ?? []).entries()) sourceImages.push({ sourcePath: image, media_type: 'gallery', display_order: index })
  for (const image of sourceImages) {
    if (!image.sourcePath.startsWith('/')) { errors.push(`${project.slug}: external image was not imported (${image.sourcePath})`); continue }
    const localPath = resolve('public', image.sourcePath.slice(1))
    const publicRelativePath = relative(resolve('public'), localPath)
    if (!publicRelativePath || publicRelativePath.startsWith('..') || isAbsolute(publicRelativePath) || !await exists(localPath)) { errors.push(`${project.slug}: image file not found (${image.sourcePath})`); continue }
    const ext = extname(localPath).slice(1).toLowerCase()
    const extension = ext === 'jpeg' ? 'jpg' : ext
    if (!['jpg', 'png', 'webp', 'avif'].includes(extension)) { errors.push(`${project.slug}: unsupported image extension (${extension})`); continue }
    const storagePath = `projects/${id}/${uuidFrom(`geniastra-image:${project.slug}:${image.sourcePath}`)}.${extension}`
    if (seenStoragePaths.has(storagePath)) {
      errors.push(`${project.slug}: duplicate image source (${image.sourcePath})`)
      continue
    }
    seenStoragePaths.add(storagePath)
    const mediaId = uuidFrom(`geniastra-media:${project.slug}:${image.sourcePath}`)
    const name = project.title?.en ?? project.title ?? project.slug
    mediaRows.push({ id: mediaId, project_id: id, storage_path: storagePath, media_type: image.media_type, alt_text_id: `${name} ${image.media_type === 'cover' ? 'sampul proyek' : `gambar ${image.display_order + 1}`}`, alt_text_en: `${name} ${image.media_type === 'cover' ? 'project cover' : `image ${image.display_order + 1}`}`, caption_id: null, caption_en: null, display_order: image.display_order })
    filesToUpload.push({ localPath, storagePath, extension })
  }
}

for (const project of builtInProjects) await normalizedProject(project, 'builtin')
for (const project of managed) await normalizedProject(project, 'managed')
for (const [index, item] of (siteContent.experience?.education ?? []).entries()) educationRows.push({ id: uuidFrom(`geniastra-education:${item.title}`), title: item.title, detail_id: item.detail?.id ?? '', detail_en: item.detail?.en ?? '', period_label: item.period ?? '', display_order: index, is_published: true })
for (const [index, item] of (siteContent.experience?.organization ?? []).entries()) {
  const id = uuidFrom(`geniastra-experience:organization:${item.period}:${item.title?.en ?? item.title?.id}`)
  experienceRows.push({ id, kind: 'organization', display_order: index, period_label: item.period ?? '', is_published: true })
  for (const locale of ['id', 'en']) experienceTranslationRows.push({ id: uuidFrom(`${id}:${locale}`), experience_id: id, locale, title: item.title?.[locale] ?? '', description: '' })
}

const report = { mode: apply ? 'apply' : 'dry-run', projects: projectRows.length, translations: projectRows.translations?.length ?? 0, mediaRecords: mediaRows.length, imagesToUpload: filesToUpload.length, siteContentValues: siteContentRows.length, settings: settings.length, education: educationRows.length, organizations: experienceRows.length, errors }
if (!apply) {
  console.info(JSON.stringify(report, null, 2))
  console.info('No remote changes made. Review the dry-run report, then pass --apply with valid Supabase environment variables after explicit owner approval.')
  process.exit(errors.length ? 1 : 0)
}
if (errors.length) {
  console.info(JSON.stringify({ ...report, mode: 'apply', errors }, null, 2))
  console.error('Preflight errors found. No remote changes were made.')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()
if (!url || !secretKey) throw new Error('Import requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY. No remote changes were made.')
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
for (const image of filesToUpload) {
  try {
    const bytes = await readFile(image.localPath)
    const contentType = ({ jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' })[image.extension]
    const { error } = await supabase.storage.from('portfolio-media').upload(image.storagePath, bytes, { upsert: true, contentType, cacheControl: '31536000' })
    if (error) throw error
  } catch (error) { errors.push(`Storage upload failed for ${image.localPath}: ${error instanceof Error ? error.message : 'unknown error'}`) }
}

if (errors.length) {
  console.info(JSON.stringify({ ...report, mode: 'apply', errors }, null, 2))
  console.error('One or more image uploads failed. Database import was not started; retrying is safe because storage paths are stable.')
  process.exit(1)
}

const projectImages = new Set(filesToUpload.filter((file) => !errors.some((error) => error.includes(file.localPath))).map((file) => file.storagePath))
const importedMedia = mediaRows.filter((item) => projectImages.has(item.storage_path))
const steps = [
  ['projects', projectRows.map((project) => ({ id: project.id, slug: project.slug, category: project.category, featured: project.featured, display_order: project.display_order, project_url: project.project_url, github_url: project.github_url, start_date: project.start_date, end_date: project.end_date })), 'id'],
  ['project_translations', projectRows.translations ?? [], 'project_id,locale'],
  ['project_media', importedMedia, 'id'],
  ['site_content', siteContentRows, 'content_key,locale'],
  ['site_settings', settings, 'setting_key'],
  ['education', educationRows, 'id'],
  ['experiences', experienceRows, 'id'],
  ['experience_translations', experienceTranslationRows, 'experience_id,locale'],
]
for (const [table, rows, onConflict] of steps) {
  if (!rows.length) continue
  const { error } = await supabase.from(table).upsert(rows, { onConflict })
  if (error) errors.push(`${table} upsert failed: ${error.message}`)
}
if (!errors.length) {
  const { error } = await supabase.from('projects').update({ status: 'published' }).in('id', projectRows.map((project) => project.id))
  if (error) errors.push(`Publishing imported projects failed: ${error.message}`)
}
console.info(JSON.stringify({ ...report, mode: 'apply', errors }, null, 2))
if (errors.length) process.exitCode = 1
