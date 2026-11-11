import type { SiteContent } from './site-content'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function text(value: unknown, max = 1200) { return typeof value === 'string' ? value.trim().slice(0, max) : '' }
function localized(value: unknown, max = 1200) {
  const source = record(value)
  return { id: text(source.id, max), en: text(source.en, max) }
}
function lines(value: unknown, maxItems = 12) {
  return Array.isArray(value) ? value.map((item) => text(item, 1000)).filter(Boolean).slice(0, maxItems) : []
}
function url(value: unknown, allowLocalPath = false) {
  const candidate = text(value, 1000)
  if (!candidate) return ''
  if (allowLocalPath && candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.includes('\\')) return candidate
  try {
    const parsed = new URL(candidate)
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.toString() : ''
  } catch { return '' }
}
function localizedList(value: unknown) {
  const source = record(value)
  return { id: lines(source.id), en: lines(source.en) }
}

export function normalizeSiteContent(input: unknown): SiteContent | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined
  const source = record(input)
  const home = record(source.home)
  const contact = record(source.contact)
  const about = record(source.about)
  const experience = record(source.experience)
  const education = Array.isArray(experience.education) ? experience.education.slice(0, 20).map((raw) => {
    const item = record(raw)
    return { title: text(item.title, 180), detail: localized(item.detail, 180), period: text(item.period, 80) }
  }) : []
  const organization = Array.isArray(experience.organization) ? experience.organization.slice(0, 30).map((raw) => {
    const item = record(raw)
    return { title: localized(item.title, 180), period: text(item.period, 80) }
  }) : []
  const email = text(contact.email, 254)
  const normalized: SiteContent = {
    siteName: text(source.siteName, 80), fullName: text(source.fullName, 180), location: localized(source.location, 120),
    home: {
      heroEyebrow: localized(home.heroEyebrow, 120), heroTitle: localized(home.heroTitle, 500), heroText: localized(home.heroText, 1000),
      aboutEyebrow: localized(home.aboutEyebrow, 120), aboutTitle: localized(home.aboutTitle, 500), aboutText: localized(home.aboutText, 1000), strengthsList: localizedList(home.strengthsList),
    },
    about: { paragraphs: localizedList(about.paragraphs) },
    contact: { title: localized(contact.title, 300), text: localized(contact.text, 1000), email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '', github: url(contact.github), linkedin: url(contact.linkedin), cvUrl: url(contact.cvUrl, true) },
    experience: { education, organization },
  }
  const hasTranslations = [normalized.location, normalized.home.heroEyebrow, normalized.home.heroTitle, normalized.home.heroText, normalized.home.aboutEyebrow, normalized.home.aboutTitle, normalized.home.aboutText, normalized.contact.title, normalized.contact.text].every((field) => field.id && field.en)
  const hasExperience = education.every((entry) => entry.title && entry.period && entry.detail.id && entry.detail.en) && organization.every((entry) => entry.title.id && entry.title.en && entry.period)
  if (!normalized.siteName || !normalized.fullName || !hasTranslations || !hasExperience) return undefined
  return normalized
}
