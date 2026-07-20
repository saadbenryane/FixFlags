import type { Page, Route } from 'playwright'

/** Payment / checkout hosts that journeys must never complete purchases on. */
const BLOCKED_PAYMENT_HOST_PATTERN =
  /(?:^|\.)(?:stripe\.com|checkout\.stripe\.com|paypal\.com|braintreegateway\.com|square\.up\.com|adyen\.com|paddle\.com|lemonsqueezy\.com|fastspring\.com)$/i

const DOWNLOAD_EXTENSION_PATTERN = /\.(?:zip|pdf|dmg|exe|msi|apk|ipa|gz|tgz|rar|7z|csv|xlsx?)(?:\?|$)/i

const ENGAGEMENT_PATH_PATTERN =
  /newsletter|subscribe|signup|sign-up|register|contact|demo|waitlist|join|update-user/i

export interface FormProbeResult {
  url: string
  method: string
  status: number
}

export interface JourneyRouteGuardOptions {
  /** Page origin hostname; required for same-origin engagement probes. */
  originHost?: string
  /** Collect at most one engagement POST probe result. */
  formProbe?: { result: FormProbeResult | null; probed: boolean }
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

function isEngagementMutation(url: string): boolean {
  try {
    return ENGAGEMENT_PATH_PATTERN.test(new URL(url).pathname)
  } catch {
    return ENGAGEMENT_PATH_PATTERN.test(url)
  }
}

/**
 * Journey-safe route handler: keep public-URL SSRF guard, plus block payments
 * and file downloads. Mutating requests are blocked except one same-origin
 * engagement probe (newsletter/signup/contact) that records status then fulfills.
 */
export async function applyJourneyRouteGuards(
  route: Route,
  continueFn: () => Promise<void>,
  options?: JourneyRouteGuardOptions
): Promise<void> {
  const request = route.request()
  const url = request.url()
  if (isBlockedPaymentUrl(url) || isLikelyDownloadUrl(url)) {
    await route.abort('blockedbyclient')
    return
  }

  const method = request.method().toUpperCase()
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const resourceType = request.resourceType()
    if (resourceType === 'document' || resourceType === 'xhr' || resourceType === 'fetch') {
      const probe = options?.formProbe
      let sameOrigin = false
      try {
        sameOrigin = Boolean(options?.originHost) && new URL(url).hostname === options?.originHost
      } catch {
        sameOrigin = false
      }

      if (
        probe &&
        !probe.probed &&
        sameOrigin &&
        isEngagementMutation(url)
      ) {
        probe.probed = true
        try {
          const response = await route.fetch()
          probe.result = {
            url: url.slice(0, 500),
            method,
            status: response.status(),
          }
          // Fulfill with a generic error so the page does not treat the probe as success.
          await route.fulfill({
            status: 418,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'fixflags_probe',
              message: 'Probe only. Subscription/account not created.',
              upstreamStatus: response.status(),
            }),
          })
        } catch {
          probe.result = { url: url.slice(0, 500), method, status: 0 }
          await route.abort('blockedbyclient')
        }
        return
      }

      await route.abort('blockedbyclient')
      return
    }
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
