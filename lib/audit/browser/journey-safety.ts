import type { Page, Route } from 'playwright'

/** Payment / checkout hosts that journeys must never complete purchases on. */
const BLOCKED_PAYMENT_HOST_PATTERN =
  /(?:^|\.)(?:stripe\.com|checkout\.stripe\.com|paypal\.com|braintreegateway\.com|square\.up\.com|adyen\.com|paddle\.com|lemonsqueezy\.com|fastspring\.com)$/i

const DOWNLOAD_EXTENSION_PATTERN = /\.(?:zip|pdf|dmg|exe|msi|apk|ipa|gz|tgz|rar|7z|csv|xlsx?)(?:\?|$)/i

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

/**
 * Journey-safe route handler: keep public-URL SSRF guard, plus block payments
 * and file downloads. Form submits are blocked separately via page.evaluate.
 */
export async function applyJourneyRouteGuards(
  route: Route,
  continueFn: () => Promise<void>
): Promise<void> {
  const request = route.request()
  const url = request.url()
  if (isBlockedPaymentUrl(url) || isLikelyDownloadUrl(url)) {
    await route.abort('blockedbyclient')
    return
  }
  // Block POST/PUT form submissions to avoid creating real user data.
  const method = request.method().toUpperCase()
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const resourceType = request.resourceType()
    if (resourceType === 'document' || resourceType === 'xhr' || resourceType === 'fetch') {
      await route.abort('blockedbyclient')
      return
    }
  }
  await continueFn()
}

/** Compact accessibility snapshot for planner / evidence (token-efficient). */
export async function captureAccessibilityTree(page: Page, maxChars = 12_000): Promise<string> {
  try {
    // Playwright exposes aria snapshot as YAML text.
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
