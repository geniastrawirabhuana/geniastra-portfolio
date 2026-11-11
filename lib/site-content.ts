import 'server-only'
import { experience } from '@/content/portfolio'
import { getMessages } from '@/messages'
import { siteConfig, type Locale } from '@/lib/site-config'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import type { Database, Json } from '@/lib/supabase/database.types'

type Localized = { id: string; en: string }
type ContentKey = 'location' | 'home.heroEyebrow' | 'home.heroTitle' | 'home.heroText' | 'home.aboutEyebrow' | 'home.aboutTitle' | 'home.aboutText' | 'home.strengthsList' | 'about.paragraphs' | 'contact.title' | 'contact.text'
export type EducationEntry = { title: string; detail: Localized; period: string }
export type OrganizationEntry = { title: Localized; period: string }
export type SiteContent = {
  siteName: string; fullName: string; location: Localized
  home: { heroEyebrow: Localized; heroTitle: Localized; heroText: Localized; aboutEyebrow: Localized; aboutTitle: Localized; aboutText: Localized; strengthsList: { id: string[]; en: string[] } }
  about: { paragraphs: { id: string[]; en: string[] } }
  contact: { title: Localized; text: Localized; email: string; github: string; linkedin: string; cvUrl: string }
  experience: { education: EducationEntry[]; organization: OrganizationEntry[] }
}

const idMessages = getMessages('id')
const enMessages = getMessages('en')
export const defaultSiteContent: SiteContent = {
  siteName: siteConfig.name, fullName: siteConfig.fullName,
  location: { id: idMessages.location, en: enMessages.location },
  home: {
    heroEyebrow: { id: idMessages.heroEyebrow, en: enMessages.heroEyebrow }, heroTitle: { id: idMessages.heroTitle, en: enMessages.heroTitle }, heroText: { id: idMessages.heroText, en: enMessages.heroText },
    aboutEyebrow: { id: idMessages.aboutEyebrow, en: enMessages.aboutEyebrow }, aboutTitle: { id: idMessages.aboutTitle, en: enMessages.aboutTitle }, aboutText: { id: idMessages.aboutText, en: enMessages.aboutText },
    strengthsList: { id: [...idMessages.strengthsList], en: [...enMessages.strengthsList] },
  },
  about: { paragraphs: { id: [idMessages.aboutText, 'Latar belakang saya berada di bidang Teknologi Informasi, dengan ketertarikan pada bagaimana teknologi dapat membantu orang bekerja dan berkomunikasi dengan lebih baik.', 'Saya cepat belajar, mampu bekerja dalam tim, dan berkomitmen untuk terus meningkatkan kompetensi di bidang Teknologi Informasi.'], en: [enMessages.aboutText, 'My background is in Information Technology, with an interest in how technology can help people work and communicate better.', 'I learn quickly, work well in a team, and am committed to continuously improving my skills in Information Technology.'] } },
  contact: { title: { id: idMessages.contactTitle, en: enMessages.contactTitle }, text: { id: idMessages.contactText, en: enMessages.contactText }, email: siteConfig.email, github: siteConfig.github, linkedin: siteConfig.linkedin, cvUrl: siteConfig.cvPath },
  experience: { education: experience.education, organization: experience.organization },
}

type ContentRow = Database['public']['Tables']['site_content']['Row']
type SettingRow = Database['public']['Tables']['site_settings']['Row']
type EducationRow = Database['public']['Tables']['education']['Row']
const listFromText = (value?: string) => value ? value.split('\n').map((item) => item.trim()).filter(Boolean) : []

export async function getSiteContent(): Promise<SiteContent> {
  const supabase = createPublicClient()
  if (!supabase) return defaultSiteContent
  const [contentResult, settingsResult, educationResult, organizationResult] = await Promise.all([
    supabase.from('site_content').select('*'),
    supabase.from('site_settings').select('*'),
    supabase.from('education').select('*').eq('is_published', true).order('display_order'),
    supabase.from('experiences').select('*').eq('kind', 'organization').eq('is_published', true).order('display_order'),
  ])
  const failed = [contentResult, settingsResult, educationResult, organizationResult].find((result) => result.error)
  if (failed?.error) throw new Error(`Unable to load site content: ${failed.error.message}`)
  const contentRows = (contentResult.data ?? []) as ContentRow[]
  const settings = Object.fromEntries(((settingsResult.data ?? []) as SettingRow[]).map((item) => [item.setting_key, item.value]))
  const value = (key: string, locale: Locale) => contentRows.find((item) => item.content_key === key && item.locale === locale)?.value
  const localized = (key: ContentKey): Localized => ({ id: value(key, 'id') ?? defaultFor(key, 'id'), en: value(key, 'en') ?? defaultFor(key, 'en') })
  const education = ((educationResult.data ?? []) as EducationRow[]).map((item) => ({ title: item.title, detail: { id: item.detail_id, en: item.detail_en }, period: item.period_label }))
  const organizationRecords = organizationResult.data ?? []
  const organizationIds = organizationRecords.map((item) => item.id)
  const { data: organizationTranslations, error: organizationTranslationsError } = organizationIds.length
    ? await supabase.from('experience_translations').select('*').in('experience_id', organizationIds)
    : { data: [], error: null }
  if (organizationTranslationsError) throw new Error(`Unable to load organization content: ${organizationTranslationsError.message}`)
  const organization = organizationRecords.map((item) => ({
    title: { id: organizationTranslations?.find((translation) => translation.experience_id === item.id && translation.locale === 'id')?.title ?? '', en: organizationTranslations?.find((translation) => translation.experience_id === item.id && translation.locale === 'en')?.title ?? '' }, period: item.period_label,
  }))
  const idStrengths = listFromText(value('home.strengthsList', 'id'))
  const enStrengths = listFromText(value('home.strengthsList', 'en'))
  const idAboutParagraphs = listFromText(value('about.paragraphs', 'id'))
  const enAboutParagraphs = listFromText(value('about.paragraphs', 'en'))
  return {
    siteName: settings.siteName ?? defaultSiteContent.siteName, fullName: settings.fullName ?? defaultSiteContent.fullName,
    location: localized('location'),
    home: {
      heroEyebrow: localized('home.heroEyebrow'), heroTitle: localized('home.heroTitle'), heroText: localized('home.heroText'), aboutEyebrow: localized('home.aboutEyebrow'), aboutTitle: localized('home.aboutTitle'), aboutText: localized('home.aboutText'),
      strengthsList: { id: idStrengths.length ? idStrengths : defaultSiteContent.home.strengthsList.id, en: enStrengths.length ? enStrengths : defaultSiteContent.home.strengthsList.en },
    },
    about: { paragraphs: { id: idAboutParagraphs.length ? idAboutParagraphs : defaultSiteContent.about.paragraphs.id, en: enAboutParagraphs.length ? enAboutParagraphs : defaultSiteContent.about.paragraphs.en } },
    contact: { title: localized('contact.title'), text: localized('contact.text'), email: settings.email ?? defaultSiteContent.contact.email, github: settings.github ?? defaultSiteContent.contact.github, linkedin: settings.linkedin ?? defaultSiteContent.contact.linkedin, cvUrl: settings.cvUrl ?? defaultSiteContent.contact.cvUrl },
    experience: { education: education.length ? education : defaultSiteContent.experience.education, organization: organization.length ? organization : defaultSiteContent.experience.organization },
  }
}

function defaultFor(key: ContentKey, locale: Locale) {
  if (key === 'location') return defaultSiteContent.location[locale]
  if (key.startsWith('home.')) return defaultSiteContent.home[key.slice(5) as keyof SiteContent['home']][locale] as string
  if (key === 'about.paragraphs') return defaultSiteContent.about.paragraphs[locale].join('\n')
  if (key === 'contact.title') return defaultSiteContent.contact.title[locale]
  return defaultSiteContent.contact.text[locale]
}

export async function getLocalizedSiteContent(locale: Locale) {
  const content = await getSiteContent()
  return {
    siteName: content.siteName, fullName: content.fullName, location: content.location[locale], heroEyebrow: content.home.heroEyebrow[locale], heroTitle: content.home.heroTitle[locale], heroText: content.home.heroText[locale],
    aboutEyebrow: content.home.aboutEyebrow[locale], aboutTitle: content.home.aboutTitle[locale], aboutText: content.home.aboutText[locale], strengths: content.home.strengthsList[locale], aboutParagraphs: content.about.paragraphs[locale],
    contactTitle: content.contact.title[locale], contactText: content.contact.text[locale], email: content.contact.email, github: content.contact.github, linkedin: content.contact.linkedin, cvUrl: content.contact.cvUrl,
    education: content.experience.education, organization: content.experience.organization,
  }
}

export async function saveSiteContent(content: SiteContent) {
  const supabase = await createClient()
  const settings: Json = { siteName: content.siteName, fullName: content.fullName, email: content.contact.email, github: content.contact.github, linkedin: content.contact.linkedin, cvUrl: content.contact.cvUrl }
  const localizedValues: Array<{ content_key: string; locale: Locale; value: string }> = []
  const addPair = (key: string, pair: Localized) => { localizedValues.push({ content_key: key, locale: 'id', value: pair.id }, { content_key: key, locale: 'en', value: pair.en }) }
  addPair('location', content.location)
  for (const key of ['heroEyebrow', 'heroTitle', 'heroText', 'aboutEyebrow', 'aboutTitle', 'aboutText'] as const) addPair(`home.${key}`, content.home[key])
  addPair('home.strengthsList', { id: content.home.strengthsList.id.join('\n'), en: content.home.strengthsList.en.join('\n') })
  addPair('about.paragraphs', { id: content.about.paragraphs.id.join('\n'), en: content.about.paragraphs.en.join('\n') })
  addPair('contact.title', content.contact.title); addPair('contact.text', content.contact.text)
  const organizations = content.experience.organization.map((item, index) => ({ period_label: item.period, display_order: index, is_published: true, translations: [{ locale: 'id', title: item.title.id }, { locale: 'en', title: item.title.en }] }))
  const { error } = await supabase.rpc('save_site_content_bundle', {
    p_settings: settings,
    p_values: localizedValues as unknown as Json,
    p_education: content.experience.education.map((item, index) => ({ title: item.title, detail_id: item.detail.id, detail_en: item.detail.en, period_label: item.period, display_order: index, is_published: true })) as unknown as Json,
    p_organizations: organizations as unknown as Json,
  })
  if (error) throw new Error(`Unable to save site content: ${error.message}`)
}
