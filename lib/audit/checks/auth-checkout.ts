import { PageMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'
import { openCheckDestination } from '../open-check'
import { destinationContext, displayDestination, destinationScope, DESTINATION_VERIFICATION_RULE, type DestinationCheckOptions } from './destination-evidence'
import { resolvedPageLinks } from './public-links'

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

/**
 * Auth & checkout smoke scan (EXPERIENCE): the conversion and revenue paths must
 * actually resolve. Complements `broken-internal-links` by covering cross-origin
 * payment links and framing dead auth/checkout paths by their business impact.
 */
export async function runAuthCheckoutChecks(
  pageUrl: string,
  meta: PageMetadata,
  options: DestinationCheckOptions = {},
): Promise<DeterministicFlag[]> {
  const seen = new Set<string>()
  const candidates: Array<{ url: string; kind: LinkKind }> = []
  const deadAuth: string[] = [], deadCheckout: string[] = []
  const targets = { auth: [] as NonNullable<DeterministicFlag['evidenceTargets']>, checkout: [] as NonNullable<DeterministicFlag['evidenceTargets']> }
  for (const link of resolvedPageLinks(pageUrl, meta)) {
    if (!link.href || /^(?:#|mailto:|tel:)/i.test(link.href)) continue
    const kind = classifyLink(link)
    if (!kind) continue
    let url: URL
    try { url = new URL(link.href, pageUrl) } catch { continue }
    if (!['http:', 'https:'].includes(url.protocol)) continue
    url.hash = ''
    if (seen.has(url.toString())) continue
    seen.add(url.toString())
    candidates.push({ url: url.toString(), kind })
  }
  const deadline = Math.min(options.deadline ?? Infinity, Date.now() + 8_000)
  let complete = candidates.length <= MAX_LINK_CHECKS
  await Promise.all(candidates.slice(0, MAX_LINK_CHECKS).map(async ({ url, kind }) => {
    const result = await openCheckDestination(url, { timeoutMs: FETCH_TIMEOUT_MS, deadline, httpErrorsOnly: true })
    const passed = result.outcome !== 'blocked' && result.status !== null && result.status >= 200 && result.status < 300
    const conclusive = passed || result.shouldFlagDead
    const context = destinationContext(pageUrl, url)
    options.record?.({ key: kind + '-destination', name: kind === 'checkout' ? 'Checkout link response' : 'Sign-in link response',
      expected: 'The public destination responds to GET without a missing-page or server error',
      observed: `${displayDestination(url)}: ${result.status === null ? result.outcome : `GET HTTP ${result.status} (${result.outcome})`}. Interactive and authenticated behavior was not tested.`,
      passed, complete: conclusive, context })
    if (!conclusive) complete = false
    if (result.shouldFlagDead) {
      ;(kind === 'checkout' ? deadCheckout : deadAuth).push(displayDestination(url))
      targets[kind].push({ kind: 'page', source: 'measured', device: 'desktop', label: 'Public destination response', context })
    }
  }))
  destinationScope(options, complete, 'GET responses cover up to eight distinct public action destinations. Network errors, scanner refusals, access restrictions and untested destinations remain unknown. No login, checkout or payment is submitted.')

  const findings: DeterministicFlag[] = []

  if (deadCheckout.length > 0) {
    findings.push({
      checkId: 'checkout-link-dead',
      evidenceTargets: targets.checkout, verificationRule: DESTINATION_VERIFICATION_RULE,
      rubric: 'EXPERIENCE',
      impactTag: 'REVENUE',
      severity: 'CRITICAL',
      problem: `${deadCheckout.length} checkout or payment link${deadCheckout.length > 1 ? 's' : ''} did not resolve`,
      evidence: deadCheckout.slice(0, 3).join('; '),
      fix: '1. Fix the checkout/payment link so customers can actually pay\n2. Verify the Stripe/PayPal/Paddle URL or /checkout route returns a working page\n3. Update any expired payment links or re-activate the subscription plan',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (deadAuth.length > 0) {
    findings.push({
      checkId: 'auth-page-broken',
      evidenceTargets: targets.auth, verificationRule: DESTINATION_VERIFICATION_RULE,
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: `${deadAuth.length} login or sign-up link${deadAuth.length > 1 ? 's' : ''} did not resolve`,
      evidence: deadAuth.slice(0, 3).join('; '),
      fix: '1. Repair the auth entry point so visitors can sign up or log in\n2. Point the link at a live route and confirm the page renders\n3. Test the full auth flow (sign up → confirm → log in)',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
