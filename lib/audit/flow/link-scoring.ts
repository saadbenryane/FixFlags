/** Shared CTA / conversion-path link scoring for critical path and flow scan. */

const AUTH_UTILITY_PATTERN = /\b(login|log in|sign in|signin)\b/i
const PRICING_PATTERN = /pricing|plans?\b|price/
const PRIMARY_CONVERSION_PATTERN =
  /book (a call|demo)|schedule|get started|start free|try free|sign up|signup|register|get-started|start trial|contact sales|request demo|watch demo|get early access|claim (your|this|the|a spot)|reserve (my|your|a|the|your spot|a spot)|shop now|browse (our|the|all|plans|packages)|see (how|what|the|our|it|it in action)|view (plans|pricing|products|our|the|demo)|find (your|out)/i
const SECONDARY_CONVERSION_PATTERN = /signup|sign-up|register|try|demo|contact|book|learn more|explore|shop|browse|watch|find|claim|reserve/i

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
    const parsed = new URL(href, origin)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    if (parsed.origin === origin) return false
    const resolved = parsed.toString()
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
