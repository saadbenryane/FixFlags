import type { Page, Route } from 'playwright'

/** Payment / checkout hosts that journeys must never complete purchases on. */
const BLOCKED_PAYMENT_HOST_PATTERN =
  /(?:^|\.)(?:stripe\.com|checkout\.stripe\.com|paypal\.com|braintreegateway\.com|square\.up\.com|adyen\.com|paddle\.com|lemonsqueezy\.com|fastspring\.com)$/i

const DOWNLOAD_EXTENSION_PATTERN = /\.(?:zip|pdf|dmg|exe|msi|apk|ipa|gz|tgz|rar|7z|csv|xlsx?)(?:\?|$)/i

/** Same-origin cart/checkout POSTs that a buy-path walk must be allowed to fire. */
const CART_MUTATION_PATH_PATTERN =
  /\/(?:cart(?:\/add(?:\.js)?)?|checkouts?|wallets|payments)(?:\/|$|\?|\.js)/i

export interface FormProbeResult {
  url: string
  method: string
  status: number
}

export interface JourneyRouteGuardOptions {
  /** Full origin, including protocol and port. Hostname alone grants no mutation authority. */
  origin?: string
  /** Page origin hostname; required for same-origin engagement probes. */
  originHost?: string
  /** Collect at most one engagement POST probe result. */
  formProbe?: { result: FormProbeResult | null; probed: boolean }
  /**
   * Allow same-origin POST/PUT/PATCH to cart and checkout endpoints so a
   * buy-path walk can add to cart. Payment hosts stay blocked.
   */
  allowCartMutations?: boolean
  onRefusal?: (reason: 'protected_action_requires_fixture' | 'payment_or_download_blocked') => void
}

export function isBlockedPaymentUrl(url: string): boolean {
  try {
    return BLOCKED_PAYMENT_HOST_PATTERN.test(new URL(url).hostname)
  } catch {
    return false
  }
}

export function isLikelyDownloadUrl(url: string): boolean {
  try {
    return DOWNLOAD_EXTENSION_PATTERN.test(new URL(url).pathname)
  } catch {
    return DOWNLOAD_EXTENSION_PATTERN.test(url)
  }
}

export function isCartMutationPath(url: string): boolean {
  try {
    return CART_MUTATION_PATH_PATTERN.test(new URL(url).pathname)
  } catch {
    return CART_MUTATION_PATH_PATTERN.test(url)
  }
}

/**
 * Journey-safe route handler: keep public-URL SSRF guard, plus block payments
 * and file downloads. Public engagement requests are never sent as probes:
 * a successful POST can create real accounts or messages even if we hide its response.
 * Reversible Signup submission is owned by the authorized fixture executor.
 */
export async function applyJourneyRouteGuards(
  route: Route,
  continueFn: () => Promise<void>,
  options?: JourneyRouteGuardOptions
): Promise<void> {
  const request = route.request()
  const url = request.url()
  if (isBlockedPaymentUrl(url) || isLikelyDownloadUrl(url)) {
    options?.onRefusal?.('payment_or_download_blocked')
    await route.abort('blockedbyclient')
    return
  }

  const method = request.method().toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      let sameOrigin = false
      try {
        sameOrigin = Boolean(options?.origin) && new URL(url).origin === options?.origin
      } catch {
        sameOrigin = false
      }

      // Cart entry is reversible in this isolated context. Payment, wallet and
      // checkout submission endpoints are not authorized by a cart permission.
      const cartEntry = /\/cart(?:\/(?:add|change|update|clear))?(?:\.js)?\/?$/i.test(new URL(url).pathname)
      if (options?.allowCartMutations && sameOrigin && cartEntry) {
        await continueFn()
        return
      }

      options?.onRefusal?.('protected_action_requires_fixture')
      await route.abort('blockedbyclient')
      return
  }
  await continueFn()
}

/** Compact accessibility snapshot for planner / evidence (token-efficient). */
export async function captureAccessibilityTree(page: Page, maxChars = 12_000): Promise<string> {
  try {
    const snapshot = await page.locator('body').ariaSnapshot()
    if (!snapshot) return ''
    return snapshot.length > maxChars ? `${snapshot.slice(0, maxChars)}…` : snapshot
  } catch {
    return ''
  }
}

/** Prevent native form submit while allowing fill/focus for UX probes. */
export async function blockFormSubmits(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.addEventListener(
      'submit',
      (event) => {
        event.preventDefault()
        event.stopPropagation()
      },
      true
    )
  })
}

/** Disposable probe identity for engagement form fills. */
export function probeEmailForAudit(auditId: string): string {
  const safe = auditId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || 'probe'
  return `fixflags-probe+${safe}@example.com`
}
