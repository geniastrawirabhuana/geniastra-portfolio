import type { Metadata } from 'next'
import { getSiteUrl, siteConfig, type Locale } from './site-config'

export function localizedMetadata(locale: Locale, path: string, title: string, description: string): Metadata {
  const siteUrl = getSiteUrl()
  const canonical = `${siteUrl}/${locale}${path}`
  const idUrl = `${siteUrl}/id${path}`
  const enUrl = `${siteUrl}/en${path}`

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { 'id-ID': idUrl, en: enUrl, 'x-default': idUrl },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: siteConfig.name,
      type: 'website',
      locale: locale === 'id' ? 'id_ID' : 'en_US',
      images: [{ url: `${siteUrl}/og-image.png`, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [`${siteUrl}/og-image.png`] },
  }
}
