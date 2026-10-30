import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-config'
import { projects } from '@/content/portfolio'

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl()
  const paths = ['', '/about', '/projects', ...projects.map((project) => `/projects/${project.slug}`), '/experience', '/contact']
  return paths.flatMap((path) => ['id', 'en'].map((locale) => ({
    url: `${siteUrl}/${locale}${path}`,
    alternates: { languages: { 'id-ID': `${siteUrl}/id${path}`, en: `${siteUrl}/en${path}`, 'x-default': `${siteUrl}/id${path}` } },
  })))
}
