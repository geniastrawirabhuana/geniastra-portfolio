import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-config'
import { projects } from '@/content/portfolio'

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl()
  if (!siteUrl) return []
  const paths = ['', '/about', '/projects', ...projects.map((project) => `/projects/${project.slug}`), '/experience', '/contact']
  return paths.flatMap((path) => ['id', 'en'].map((locale) => ({
    url: `${siteUrl.origin}/${locale}${path}`,
    alternates: { languages: { 'id-ID': `${siteUrl.origin}/id${path}`, en: `${siteUrl.origin}/en${path}`, 'x-default': `${siteUrl.origin}/id${path}` } },
  })))
}
