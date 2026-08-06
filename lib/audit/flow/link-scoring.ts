/** Shared CTA / conversion-path link scoring for critical path and flow scan. */
import { normalizeSiteHost } from '@/lib/utils/url-helpers'
export { normalizeSiteHost }

const AUTH_UTILITY_PATTERN = /\b(login|log in|sign in|signin)\b/i
const PRICING_PATTERN = /pricing|plans?\b|price/
const PRIMARY_CONVERSION_PATTERN =
  /book (a call|demo)|schedule|get started|start free|try free|sign up|signup|register|get-started|start trial|contact sales|request demo|watch demo|get early access|claim (your|this|the|a spot)|reserve (my|your|a|the|your spot|a spot)|shop now|browse (our|the|all|plans|packages)|see (how|what|the|our|it|it in action)|view (plans|pricing|products|our|the|demo)|find (your|out)/i
const FEATURES_PATTERN = /\b(features?|product|how it works|solutions?|integrations?|capabilities|what we do|platform)\b/i
const SECONDARY_CONVERSION_PATTERN = /signup|sign-up|register|try|demo|contact|book|learn more|explore|shop|browse|watch|find|claim|reserve/i
const TRUST_PATTERN = /\b(about|team|company|customers?|case studies?|testimonials?|stories|our story|who we are)\b/i
const RESOURCES_PATTERN = /\b(docs?|resources?|blog|guides?|api|documentation|help|support|faq|changelog)\b/i
const NON_PAGE_PROTOCOLS = new Set(['mailto:', 'tel:', 'sms:'])

export interface CtaHrefOptions {
  baseUrl?: string
  /** True only when a same-page hash points at a real element on the page. */
  hashTargetExists?: boolean
}

export interface CtaHrefClassification {
  href: string | null
  resolvedHref: string | null
  protocol: string | null
  isPlaceholder: boolean
  isPageNavigation: boolean
  isSamePageAnchor: boolean
  isActionable: boolean
}

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
    if (isSameSiteOrigin(parsed.origin, origin)) return false
    const resolved = parsed.toString()
    return isExternalBookingHref(resolved) || scoreCtaLink(resolved, '') >= 70
  } catch {
    return false
  }
}

export function classifyCtaHref(
  href: string | null | undefined,
  options: CtaHrefOptions = {}
): CtaHrefClassification {
  const raw = typeof href === 'string' ? href.trim() : ''
  const fallback = {
    href: raw || null,
    resolvedHref: null,
    protocol: null,
    isPlaceholder: true,
    isPageNavigation: false,
    isSamePageAnchor: false,
    isActionable: false,
  }

  if (!raw || raw === '#') return fallback

  const lower = raw.toLowerCase()
  if (
    lower === 'javascript:;' ||
    lower.startsWith('javascript:') ||
    lower === 'about:blank'
  ) {
    return fallback
  }

  if (raw.startsWith('#')) {
    const actionable = Boolean(options.hashTargetExists)
    return {
      href: raw,
      resolvedHref: options.baseUrl ? new URL(raw, options.baseUrl).toString() : raw,
      protocol: null,
      isPlaceholder: !actionable,
      isPageNavigation: actionable,
      isSamePageAnchor: actionable,
      isActionable: actionable,
    }
  }

  // Relative URL (no protocol scheme) means it's a same-site page link
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) && !raw.startsWith('//')) {
    const resolvedHref = options.baseUrl ? new URL(raw, options.baseUrl).toString() : null
    return {
      href: raw,
      resolvedHref,
      protocol: null,
      isPlaceholder: false,
      isPageNavigation: true,
      isSamePageAnchor: false,
      isActionable: true,
    }
  }

  try {
    const parsed = options.baseUrl ? new URL(raw, options.baseUrl) : new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      // mailto:, tel:, sms: open an external app - intentional, working
      // destinations, NOT dead/placeholder links. They are still not page
      // navigations, so the flow scan must not try to click them.
      const isIntentionalAction = NON_PAGE_PROTOCOLS.has(parsed.protocol)
      return {
        href: raw,
        resolvedHref: parsed.toString(),
        protocol: parsed.protocol,
        isPlaceholder: !isIntentionalAction,
        isPageNavigation: false,
        isSamePageAnchor: false,
        isActionable: isIntentionalAction,
      }
    }

    const isSamePageAnchor = (() => {
      if (!options.baseUrl || !parsed.hash) return false
      const base = options.baseUrl
      return (
        parsed.origin === new URL(base).origin &&
        parsed.pathname === new URL(base).pathname &&
        parsed.search === new URL(base).search
      )
    })()
    const anchorIsActionable = !isSamePageAnchor || Boolean(options.hashTargetExists)

    return {
      href: raw,
      resolvedHref: parsed.toString(),
      protocol: parsed.protocol,
      isPlaceholder: isSamePageAnchor && !anchorIsActionable,
      isPageNavigation: anchorIsActionable,
      isSamePageAnchor,
      isActionable: anchorIsActionable,
    }
  } catch {
    return fallback
  }
}

export function isActionableCtaHref(
  href: string | null | undefined,
  options: CtaHrefOptions = {}
): boolean {
  return classifyCtaHref(href, options).isActionable
}

export type LinkCategory =
  | 'pricing'
  | 'primary-cta'
  | 'features'
  | 'secondary-cta'
  | 'trust'
  | 'resources'
  | 'auth'
  | 'other'

const CATEGORY_MAX: Record<LinkCategory, number> = {
  pricing: 1,
  'primary-cta': 1,
  features: 1,
  'secondary-cta': 1,
  trust: 1,
  resources: 1,
  auth: 0,
  other: 0,
}

export function classifyLinkCategory(href: string, text: string): LinkCategory {
  const combined = `${href} ${text}`.toLowerCase()
  if (isAuthUtilityLink(href, text)) return 'auth'
  if (PRICING_PATTERN.test(combined)) return 'pricing'
  if (PRIMARY_CONVERSION_PATTERN.test(combined)) return 'primary-cta'
  if (FEATURES_PATTERN.test(combined)) return 'features'
  if (SECONDARY_CONVERSION_PATTERN.test(combined)) return 'secondary-cta'
  if (TRUST_PATTERN.test(combined)) return 'trust'
  if (RESOURCES_PATTERN.test(combined)) return 'resources'
  return 'other'
}

export function scoreCtaLink(href: string, text: string): number {
  const combined = `${href} ${text}`.toLowerCase()

  // Header auth links are not the primary conversion CTA for landing pages.
  if (isAuthUtilityLink(href, text)) return 15

  if (PRICING_PATTERN.test(combined)) return 100
  if (PRIMARY_CONVERSION_PATTERN.test(combined)) return 95
  if (FEATURES_PATTERN.test(combined)) return 80
  if (SECONDARY_CONVERSION_PATTERN.test(combined)) return 70
  if (TRUST_PATTERN.test(combined)) return 60
  if (RESOURCES_PATTERN.test(combined)) return 40
  return 0
}

/** Maximum pages to discover per link category (used by critical path). */
export { CATEGORY_MAX }

export function isDeadHref(href: string): boolean {
  return classifyCtaHref(href).isPlaceholder
}

/**
 * True when the href intentionally opens an external app (mail, phone, SMS)
 * instead of navigating the page. Such CTAs are real and should never be
 * flagged as dead, but the flow scan must not select them as page-navigation
 * candidates.
 */
export function isNonPageActionHref(href: string | null | undefined): boolean {
  if (!href) return false
  try {
    const protocol = new URL(href).protocol
    return protocol.endsWith(':') && NON_PAGE_PROTOCOLS.has(protocol)
  } catch {
    return false
  }
}

export function isSameSiteOrigin(originA: string, originB: string): boolean {
  try {
    const a = normalizeSiteHost(new URL(originA).hostname)
    const b = normalizeSiteHost(new URL(originB).hostname)
    return a === b
  } catch {
    return false
  }
}

export function resolveSameOrigin(origin: string, href: string): string | null {
  try {
    if (href.startsWith('/')) return new URL(href, origin).toString()
    const parsed = new URL(href)
    if (isSameSiteOrigin(parsed.origin, origin)) return parsed.toString()
    return null
  } catch {
    return null
  }
}
