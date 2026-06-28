import { PageMetadata } from '../metadata'
import { DeterministicFlag } from './index'

const MAX_LINK_CHECKS = 8
const FETCH_TIMEOUT_MS = 4000

/** Login / sign-up / register entry points. */
const AUTH_RE =
  /\b(log\s?in|sign\s?in|signin|sign\s?up|signup|register|create account)\b/i
/** Checkout / billing / subscription paths. */
const CHECKOUT_RE =
  /\b(checkout|check-out|subscribe|upgrade|start (free )?trial|billing|purchase|buy now)\b/i
/** Hosted payment providers (cross-origin, not covered by broken-internal-links). */
const PAYMENT_HOST_RE =
  /(buy\.stripe\.com|checkout\.stripe\.com|paypal\.com|paddle\.com|lemonsqueezy\.com|gumroad\.com|chargebee\.com)/i

type LinkKind = 'auth' | 'checkout'

function classifyLink(link: { href: string; text: string }): LinkKind | null {
  const haystack = `${link.href} ${link.text}`
  if (PAYMENT_HOST_RE.test(link.href) || CHECKOUT_RE.test(haystack)) return 'checkout'
  if (AUTH_RE.test(haystack)) return 'auth'
  return null
}

/** True only on a definitive HTTP error (404 / 5xx); HEAD-blocking hosts and
 *  transient network errors are left alone to avoid false "dead path" alarms. */
async function linkIsDead(absolute: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(absolute, { method: 'HEAD', signal: controller.signal })
    clearTimeout(timer)
    return res.status === 404 || res.status >= 500
  } catch {
    return false
  }
}

/**
 * Auth & checkout smoke scan (EXPERIENCE): the conversion and revenue paths must
 * actually resolve. Complements `broken-internal-links` by covering cross-origin
 * payment links and framing dead auth/checkout paths by their business impact.
 */
export async function runAuthCheckoutChecks(
  pageUrl: string,
  meta: PageMetadata
): Promise<DeterministicFlag[]> {
  const seen = new Set<string>()
  const deadAuth: string[] = []
  const deadCheckout: string[] = []
  let checks = 0

  for (const link of meta.links) {
    if (checks >= MAX_LINK_CHECKS) break
    if (!link.href || link.href.startsWith('#') || link.href.startsWith('mailto:')) continue

    const kind = classifyLink(link)
    if (!kind) continue

    let absolute: string
    try {
      absolute = new URL(link.href, pageUrl).toString()
    } catch {
      continue
    }
    if (seen.has(absolute)) continue
    seen.add(absolute)
    checks++

    if (await linkIsDead(absolute)) {
      if (kind === 'checkout') deadCheckout.push(absolute)
      else deadAuth.push(absolute)
    }
  }

  const findings: DeterministicFlag[] = []

  if (deadCheckout.length > 0) {
    findings.push({
      checkId: 'checkout-link-dead',
      rubric: 'EXPERIENCE',
      impactTag: 'REVENUE',
      severity: 'CRITICAL',
      problem: `${deadCheckout.length} checkout or payment link${deadCheckout.length > 1 ? 's' : ''} did not resolve`,
      evidence: deadCheckout.slice(0, 3).join('; '),
      fix: 'Fix the checkout/payment link so customers can actually pay. Verify the Stripe/PayPal/Paddle URL or your /checkout route returns a working page, and update any expired payment links.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (deadAuth.length > 0) {
    findings.push({
      checkId: 'auth-page-broken',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: `${deadAuth.length} login or sign-up link${deadAuth.length > 1 ? 's' : ''} did not resolve`,
      evidence: deadAuth.slice(0, 3).join('; '),
      fix: 'Repair the auth entry point so visitors can sign up or log in. Point the link at a live route and confirm the page renders without an error.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
