/**
 * Validate mutation origins without trusting proxy-supplied host headers.
 * In production the canonical public origin must be configured explicitly.
 */
export function isAllowedAdminOrigin(
  originHeader: string | null,
  requestUrl: string,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!originHeader) return false

  if (environment.NODE_ENV !== 'production') {
    try {
      return originHeader === new URL(requestUrl).origin
    } catch {
      return false
    }
  }

  const configuredSiteUrl = environment.NEXT_PUBLIC_SITE_URL?.trim()
  if (!configuredSiteUrl) return false

  try {
    const configuredUrl = new URL(configuredSiteUrl)
    if (
      configuredUrl.protocol !== 'https:' ||
      !configuredUrl.hostname ||
      configuredUrl.username ||
      configuredUrl.password ||
      configuredUrl.hostname === 'localhost' ||
      configuredUrl.hostname.endsWith('.localhost') ||
      configuredUrl.hostname.endsWith('.local')
    ) return false

    return originHeader === configuredUrl.origin
  } catch {
    return false
  }
}
