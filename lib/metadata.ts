import type { Metadata } from 'next'
import { getSiteUrl, siteConfig, type Locale } from './site-config'

export function localizedMetadata(locale: Locale, path: string, title: string, description: string): Metadata {
  const siteUrl = getSiteUrl()
  return {
    title,
    description,
    ...(siteUrl && {
      alternates: {
        canonical: `${siteUrl.origin}/${locale}${path}`,
        languages: { 'id-ID': `${siteUrl.origin}/id${path}`, en: `${siteUrl.origin}/en${path}`, 'x-default': `${siteUrl.origin}/id${path}` },
      },
    }),
    openGraph: {
      title,
      description,
      ...(siteUrl && { url: `${siteUrl.origin}/${locale}${path}` }),
      siteName: siteConfig.name,
      type: 'website',
      locale: locale === 'id' ? 'id_ID' : 'en_US',
      ...(siteUrl && { images: [{ url: `${siteUrl.origin}/og-image.png`, width: 1200, height: 630, alt: title }] }),
    },
    twitter: { card: 'summary_large_image', title, description, ...(siteUrl && { images: [`${siteUrl.origin}/og-image.png`] }) },
  }
}
