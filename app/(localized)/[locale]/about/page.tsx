import type { Metadata } from 'next'
import { getMessages } from '@/messages'
import { getSiteUrl, type Locale } from '@/lib/site-config'
import { localizedMetadata } from '@/lib/metadata'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const l = locale as Locale
  const m = getMessages(l)
  return localizedMetadata(l, '/about', l === 'id' ? 'Tentang — GENIASTRA' : 'About — GENIASTRA', m.aboutText)
}

export default async function About({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params
  const locale = localeParam as Locale
  const m = getMessages(locale)
  const siteUrl = getSiteUrl()
  const profile = { '@context': 'https://schema.org', '@type': 'ProfilePage', '@id': `${siteUrl}/${locale}/about#profile`, url: `${siteUrl}/${locale}/about`, name: m.aboutTitle, mainEntity: { '@id': `${siteUrl}/#person` } }
  return <main className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profile) }} /><p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#3559D8]">{m.aboutEyebrow}</p><h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.05em] sm:text-7xl">{m.aboutTitle}</h1><div className="mt-16 grid gap-12 border-t border-[#dededb] pt-10 lg:grid-cols-[.7fr_1.3fr]"><p className="text-sm text-[#646872]">{m.heroEyebrow}</p><div className="max-w-2xl space-y-6 text-lg leading-8 text-[#646872]"><p>{m.aboutText}</p><p>{locale === 'id' ? 'Latar belakang saya berada di bidang Teknologi Informasi, dengan ketertarikan pada bagaimana teknologi dapat membantu orang bekerja dan berkomunikasi dengan lebih baik.' : 'My background is in Information Technology, with an interest in how technology can help people work and communicate better.'}</p><p>{locale === 'id' ? 'Saya cepat belajar, mampu bekerja dalam tim, dan berkomitmen untuk terus meningkatkan kompetensi di bidang Teknologi Informasi.' : 'I learn quickly, work well in a team, and am committed to continuously improving my skills in Information Technology.'}</p></div></div></main>
}
