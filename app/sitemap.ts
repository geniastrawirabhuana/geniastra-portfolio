import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-config'
import { getPortfolioSlugs } from '@/lib/projects'


export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  if (!siteUrl) return []
  const slugs = await getPortfolioSlugs()
  const paths = ['', '/about', '/projects', ...slugs.map((slug) => `/projects/${slug}`), '/experience', '/contact']
  return paths.flatMap((path) => ['id', 'en'].map((locale) => ({
    url: `${siteUrl.origin}/${locale}${path}`,
    alternates: { languages: { 'id-ID': `${siteUrl.origin}/id${path}`, en: `${siteUrl.origin}/en${path}`, 'x-default': `${siteUrl.origin}/id${path}` } },
  })))
}
