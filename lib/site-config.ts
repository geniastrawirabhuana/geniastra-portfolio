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

const placeholderSuffixes = ['.example.com', '.example.org', '.example.net', '.invalid', '.example', '.test', '.localhost', '.local', '.internal']

function hostValue(value: string) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`
}

function isVercelProduction() {
  return process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production'
}

function isPlaceholderHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return placeholderHosts.has(host)
    || host.startsWith('127.')
    || host === '[::1]'
    || host === '[::]'
    || (!host.includes('.') && !host.startsWith('['))
    || placeholderSuffixes.some((suffix) => host.endsWith(suffix))
}

export function getSiteUrl(): URL | undefined {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const productionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  const deploymentDomain = process.env.VERCEL_URL?.trim()
  const value = configured || (productionDomain && hostValue(productionDomain)) || (deploymentDomain && hostValue(deploymentDomain))

  if (!value) {
    if (isVercelProduction()) {
      throw new Error('Set NEXT_PUBLIC_SITE_URL or a Vercel production URL before production deployment.')
    }
    return process.env.NODE_ENV === 'production' ? undefined : new URL('http://localhost:3000')
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('The public site URL must be a valid absolute URL.')
  }

  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new Error('The public site URL must be a valid absolute HTTP or HTTPS URL.')
  }

  if (isVercelProduction()) {
    if (url.protocol !== 'https:') {
      throw new Error('Production public URLs must use HTTPS.')
    }
    if (url.username || url.password) {
      throw new Error('Production public URLs cannot contain credentials.')
    }
    if (isPlaceholderHost(url.hostname)) {
      throw new Error('Production public URLs cannot use localhost or a placeholder domain.')
    }
  }

  return new URL(url.origin)
}

export function localePath(locale: Locale, path = '') {
  return `/${locale}${path}`
}
