import type { Metadata } from 'next'
import { getSiteUrl, type Locale } from '@/lib/site-config'
import { localizedMetadata } from '@/lib/metadata'
import { getLocalizedSiteContent } from '@/lib/site-content'


export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const l = locale as Locale
  const content = await getLocalizedSiteContent(l)
  const title = l === 'id' ? `Tentang — ${content.siteName}` : `About — ${content.siteName}`
  return localizedMetadata(l, '/about', title, content.aboutParagraphs[0] ?? '')
}

export default async function About({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params
  const locale = localeParam as Locale
  const content = await getLocalizedSiteContent(locale)
  const siteUrl = getSiteUrl()
  const profile = siteUrl ? { '@context': 'https://schema.org', '@type': 'ProfilePage', '@id': `${siteUrl.origin}/${locale}/about#profile`, url: `${siteUrl.origin}/${locale}/about`, name: content.aboutTitle, mainEntity: { '@id': `${siteUrl.origin}/#person` } } : null
  return <main className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">{profile && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profile) }} />}<p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#3559D8]">{content.aboutEyebrow}</p><h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.05em] sm:text-7xl">{content.aboutTitle}</h1><p className="mt-5 text-sm text-[#646872]">{content.fullName}</p><div className="mt-16 grid gap-12 border-t border-[#dededb] pt-10 lg:grid-cols-[.7fr_1.3fr]"><p className="text-sm text-[#646872]">{content.heroEyebrow}</p><div className="max-w-2xl space-y-6 text-lg leading-8 text-[#646872]">{content.aboutParagraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>)}</div></div></main>
}
