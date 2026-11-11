export function publicProjectRevalidationPaths(...slugs: string[]) {
  const paths = ['/sitemap.xml']
  for (const locale of ['id', 'en']) {
    paths.push(`/${locale}`, `/${locale}/projects`)
    for (const slug of new Set(slugs.filter(Boolean))) paths.push(`/${locale}/projects/${slug}`)
  }
  return [...new Set(paths)]
}
