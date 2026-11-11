import type { Metadata } from 'next'
import Script from 'next/script'
import '../../globals.css'
import { PageShell } from '@/components/site'
import { getSiteUrl, type Locale } from '@/lib/site-config'
import { siteConfig } from '@/lib/site-config'
import { getSiteContent } from '@/lib/site-content'

export function generateStaticParams() { return [{ locale: 'id' }, { locale: 'en' }] }
export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const url = getSiteUrl()
  const path = `/${locale}`
  return {
    ...(url && {
      metadataBase: url,
      alternates: { canonical: `${url.origin}${path}`, languages: { id: `${url.origin}/id`, en: `${url.origin}/en`, 'x-default': `${url.origin}/id` } },
    }),
    title: { default: 'GENIASTRA — Web Developer Portfolio', template: '%s — GENIASTRA' },
    description: 'Portfolio GENIASTRA untuk pengembangan website, project management, dan teknologi informasi.',
    openGraph: {
      type: 'website', siteName: 'GENIASTRA', ...(url && { url: `${url.origin}${path}` }),
      title: 'GENIASTRA — Web Developer Portfolio',
      description: 'Portfolio GENIASTRA untuk pengembangan website, project management, dan teknologi informasi.',
      ...(url && { images: [{ url: `${url.origin}/og-image.png`, width: 1200, height: 630, alt: 'GENIASTRA — Web Developer Portfolio' }] }),
    },
    twitter: { card: 'summary_large_image', title: 'GENIASTRA — Web Developer Portfolio', description: 'Portfolio GENIASTRA untuk pengembangan website, project management, dan teknologi informasi.', ...(url && { images: [`${url.origin}/og-image.png`] }) },
  }
}

export default async function LocaleLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params
  const typedLocale: Locale = locale === 'en' || locale === 'id' ? locale : 'id'
  const content = await getSiteContent()
  const siteUrl = getSiteUrl()
  const person = siteUrl && { '@context': 'https://schema.org', '@type': 'Person', '@id': `${siteUrl.origin}/#person`, name: siteConfig.name, url: siteUrl.origin, jobTitle: 'Web Developer', address: { '@type': 'PostalAddress', addressLocality: 'Denpasar', addressCountry: 'ID' }, knowsAbout: ['Web Development', 'Project Management', 'Information Technology'] }
  const website = siteUrl && { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${siteUrl.origin}/#website`, url: siteUrl.origin, name: siteConfig.name }
  return <html lang={typedLocale === 'id' ? 'id-ID' : 'en'}><body>{siteUrl && <><Script id="person-schema" type="application/ld+json">{JSON.stringify(person)}</Script><Script id="website-schema" type="application/ld+json">{JSON.stringify(website)}</Script></>}<PageShell locale={typedLocale} siteName={content.siteName}>{children}</PageShell></body></html>
}
