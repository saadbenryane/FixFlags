/**
 * www vs apex must share the anonymous claim cookie. A host-only cookie is the
 * lie that makes Recheck disappear and the next POST look like a new teaser
 * (then 429 on the IP soft ceiling).
 */

export function siteHostname(appUrl?: string | null): string | null {
  const raw = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL
  if (!raw) return null
  try {
    return new URL(raw).hostname || null
  } catch {
    return null
  }
}

/** Cookie Domain for www + apex of a product host. Never localhost or .railway.app. */
export function cookieDomainForHostname(hostname: string | null | undefined): string | undefined {
  if (!hostname) return undefined
  const host = hostname.split(':')[0].toLowerCase()
  if (!host) return undefined
  if (host === 'localhost' || host.endsWith('.localhost')) return undefined
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return undefined
  if (host.endsWith('.railway.app')) return undefined
  const parts = host.split('.')
  if (parts[0] === 'www' && parts.length >= 3) {
    return `.${parts.slice(1).join('.')}`
  }
  if (parts.length === 2) {
    return `.${host}`
  }
  return undefined
}

/** Prefer the incoming Host (custom domain) then the configured app URL. */
export function sharedCookieDomain(
  appUrl?: string | null,
  requestHost?: string | null
): string | undefined {
  return cookieDomainForHostname(requestHost) ?? cookieDomainForHostname(siteHostname(appUrl))
}

export function wwwApexPair(host: string): string | null {
  const parts = host.split('.')
  if (parts[0] === 'www' && parts.length >= 3) return parts.slice(1).join('.')
  if (parts.length === 2) return `www.${host}`
  return null
}

export function isWwwApexPair(left: string, right: string): boolean {
  return wwwApexPair(left) === right || wwwApexPair(right) === left
}
