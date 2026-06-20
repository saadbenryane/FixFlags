/** Shared CTA / conversion-path link scoring for critical path and flow scan. */

const AUTH_UTILITY_PATTERN = /\b(login|log in|sign in|signin)\b/i
const PRICING_PATTERN = /pricing|plans|price/
const PRIMARY_CONVERSION_PATTERN =
  /book a call|book demo|schedule|get started|start free|try free|sign up|signup|register|get-started|start trial|contact sales|request demo/i
const SECONDARY_CONVERSION_PATTERN = /signup|sign-up|register|try|demo|contact|book/

export function isAuthUtilityLink(href: string, text: string): boolean {
  return AUTH_UTILITY_PATTERN.test(`${href} ${text}`)
}

/** Booking/scheduling links that legitimately leave the page (often in a new tab). */
export function isExternalBookingHref(href: string): boolean {
  try {
    const host = new URL(href).hostname.toLowerCase()
    return /calendly|calendar\.app|cal\.com|hubspot\.com|meetings\.|bookings\./.test(host)
  } catch {
    return false
  }
}

export function isIntentionalExternalCta(origin: string, href: string | null): boolean {
  if (!href) return false
  try {
    const resolved = href.startsWith('http') ? href : new URL(href, origin).toString()
    const parsed = new URL(resolved)
    if (parsed.origin === origin) return false
    return isExternalBookingHref(resolved) || scoreCtaLink(resolved, '') >= 70
  } catch {
    return false
  }
}

export function scoreCtaLink(href: string, text: string): number {
  const combined = `${href} ${text}`.toLowerCase()

  // Header auth links are not the primary conversion CTA for landing pages.
  if (isAuthUtilityLink(href, text)) return 15

  if (PRICING_PATTERN.test(combined)) return 100
  if (PRIMARY_CONVERSION_PATTERN.test(combined)) return 95
  if (SECONDARY_CONVERSION_PATTERN.test(combined)) return 70
  return 0
}

export function isDeadHref(href: string): boolean {
  const normalized = href.trim().toLowerCase()
  return (
    normalized === '' ||
    normalized === '#' ||
    normalized.startsWith('javascript:void') ||
    normalized === 'javascript:;'
  )
}

export function resolveSameOrigin(origin: string, href: string): string | null {
  try {
    if (href.startsWith('/')) return new URL(href, origin).toString()
    const parsed = new URL(href)
    if (parsed.origin === origin) return parsed.toString()
    return null
  } catch {
    return null
  }
}
