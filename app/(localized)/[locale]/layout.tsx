import type { Metadata } from 'next'
import Script from 'next/script'
import '../../globals.css'
import { PageShell } from '@/components/site'
import { getSiteUrl, type Locale } from '@/lib/site-config'
import { siteConfig } from '@/lib/site-config'

export function generateStaticParams() { return [{ locale: 'id' }, { locale: 'en' }] }
export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const url = getSiteUrl()
  const path = `/${locale}`
  return { metadataBase: url, title: { default: 'GENIASTRA — Web Developer Portfolio', template: '%s — GENIASTRA' }, description: 'Portfolio GENIASTRA untuk pengembangan website, project management, dan teknologi informasi.', alternates: { canonical: path, languages: { id: '/id', en: '/en', 'x-default': '/id' } }, openGraph: { type: 'website', siteName: 'GENIASTRA', url: path, title: 'GENIASTRA — Web Developer Portfolio', description: 'Portfolio GENIASTRA untuk pengembangan website, project management, dan teknologi informasi.', images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'GENIASTRA — Web Developer Portfolio' }] }, twitter: { card: 'summary_large_image', title: 'GENIASTRA — Web Developer Portfolio', description: 'Portfolio GENIASTRA untuk pengembangan website, project management, dan teknologi informasi.', images: ['/og-image.png'] } }
}

export default async function LocaleLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params
  const typedLocale: Locale = locale === 'en' || locale === 'id' ? locale : 'id'
  const person = { '@context': 'https://schema.org', '@type': 'Person', name: siteConfig.name, url: getSiteUrl(), jobTitle: 'Web Developer', address: { '@type': 'PostalAddress', addressLocality: 'Denpasar', addressCountry: 'ID' }, knowsAbout: ['Web Development', 'Project Management', 'Information Technology'] }
  return <html lang={typedLocale === 'id' ? 'id-ID' : 'en'}><body><Script id="person-schema" type="application/ld+json">{JSON.stringify(person)}</Script><PageShell locale={typedLocale}>{children}</PageShell></body></html>
}
