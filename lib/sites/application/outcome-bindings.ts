import { validateBindingForOutcome, type BrowserJourneyConfig } from './binding-config'
import type { ConfirmableOutcomeKind } from '@/lib/sites/outcome-kinds'

export function buildCheckoutJourneyConfig(startUrl: string, allowLocalhost: boolean): BrowserJourneyConfig {
  return {
    startUrl,
    steps: [{ action: 'wait', waitMs: 1_000 }],
    goal: { type: 'url_pattern', pattern: '/checkouts?(/|$|\\?)', description: 'Reach the checkout page' },
    safety: 'stop-at-checkout',
    allowLocalhost,
  }
}

export function bindingForConfirmedKind(
  kind: ConfirmableOutcomeKind,
  siteUrl: string,
  fixture?: { id: string; targetUrl: string },
) {
  if (kind === 'CHECKOUT') {
    return {
      key: 'checkout-browser-v1',
      mechanism: 'BROWSER_JOURNEY' as const,
      config: {
        startUrl: siteUrl,
        steps: [{ action: 'wait', waitMs: 1_000 }],
        goal: { type: 'url_pattern' as const, pattern: '/checkouts?(/|$|\\?)', description: 'Reach the checkout page' },
        safety: 'stop-at-checkout' as const,
      },
      scope: { device: 'mobile', expected: 'checkout_reached' },
      required: true,
    }
  }
  if (kind === 'SIGNUP') {
    return {
      key: 'signup-safe-form-v1',
      mechanism: 'SAFE_FORM' as const,
      config: {
        startUrl: fixture?.targetUrl ?? siteUrl,
        safety: 'reversible' as const,
        authorized: true as const,
        fixtureId: fixture?.id ?? '',
      },
      scope: { device: 'desktop', expected: 'signup_completed' },
      required: true,
    }
  }
  if (kind === 'LOGIN' || kind === 'PASSWORD_RESET') return null
  return {
    key: 'page-availability-v1',
    mechanism: 'HTTP_AVAILABILITY' as const,
    config: { startUrl: siteUrl, expectedSelector: 'body' },
    required: true,
  }
}

/**
 * Whether FixFlags can keep a promise about this kind, derived from the
 * execution contract rather than asserted next to it.
 *
 * This is the question the confirmation command has to answer, and it has to be
 * derived, because the failure it prevents is precisely a disagreement between
 * two modules. Interactive browser bindings must either stop at checkout or use
 * an explicitly authorized reversible fixture. Signup has that tenant-scoped
 * contract. Login and Password reset remain unavailable until they can meet the
 * same standard.
 *
 * When a real fixture path lands and the config validates, this returns true and
 * the refusal disappears on its own. That is the intended way for it to change.
 */
export function outcomeKindWatchable(
  kind: ConfirmableOutcomeKind,
  siteUrl = 'https://example.com',
  fixture?: { id: string; targetUrl: string },
): boolean {
  const binding = bindingForConfirmedKind(kind, siteUrl, fixture)
  if (!binding) return false
  return validateBindingForOutcome(kind, binding.mechanism, binding.config).success
}
