export const siteConfig = {
  name: 'GENIASTRA',
  fullName: 'Ida Bagus Geniastra Wirabhuana, S.Kom.',
  email: '',
  github: '',
  linkedin: '',
  cvPath: '',
} as const

export type Locale = 'id' | 'en'
export const locales: Locale[] = ['id', 'en']

const placeholderHosts = new Set([
  'example.com',
  'example.org',
  'example.net',
  'localhost',
  '127.0.0.1',
])

function hostValue(value: string) {
  return value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`
}

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const productionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  const deploymentDomain = process.env.VERCEL_URL?.trim()
  const fallback = process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3000'
  const value = configured || (productionDomain && hostValue(productionDomain)) || (deploymentDomain && hostValue(deploymentDomain)) || fallback

  if (!value) {
    throw new Error('Set NEXT_PUBLIC_SITE_URL or a Vercel production URL before production deployment.')
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('The public site URL must be a valid absolute URL.')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('The public site URL must use HTTP or HTTPS.')
  }

  if (process.env.NODE_ENV === 'production') {
    if (url.protocol !== 'https:') {
      throw new Error('Production public URLs must use HTTPS.')
    }
    if (placeholderHosts.has(url.hostname) || url.hostname.endsWith('.invalid') || url.hostname.endsWith('.example')) {
      throw new Error('Production public URLs cannot use localhost or a placeholder domain.')
    }
  }

  return url.origin
}

export function localePath(locale: Locale, path = '') {
  return `/${locale}${path}`
}
