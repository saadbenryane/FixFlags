import type { OutcomeAssessmentState } from '@prisma/client'
import { summaryFor } from '@/lib/sites/application/binding-assessment'

export type CustomerOutcomeState = 'CLEAR' | 'FLAG' | 'COULD_NOT_VERIFY' | 'STALE'

/** Shown until reconcile stores an assessment. Home does not treat this placeholder as a result. */
export const UNASSESSED_OUTCOME_SUMMARY = 'Not verified yet.'

export function flagMatchesOutcome(
  flag: { id: string; improvementId?: string | null; outcomeId?: string | null; pageUrl?: string | null; checkId?: string | null },
  outcome: { id?: string; flagId: string | null; pageUrls: string[]; kind: string },
): boolean {
  // The persisted relationship is the only basis for a customer-facing link.
  // A diagnostic can share the same page and even a check-name fragment without
  // being the failure that produced this Outcome's assessment.
  if (flag.outcomeId && outcome.id) return flag.outcomeId === outcome.id
  return Boolean(outcome.flagId && (flag.id === outcome.flagId || flag.improvementId === outcome.flagId))
}

export function staleOutcomeRecovery(): string {
  return 'Run a fresh verification before relying on this result.'
}

export function outcomeStatusLabel(state: CustomerOutcomeState, running = false): string {
  if (running) return 'Verifying'
  if (state === 'CLEAR') return 'Clear'
  if (state === 'FLAG') return 'Flag'
  if (state === 'STALE') return 'Stale'
  return 'Couldn’t verify'
}

function freshnessDuration(minutes: number): string {
  if (minutes > 0 && minutes % (60 * 24) === 0) {
    const days = minutes / (60 * 24)
    return days === 1 ? '1 day' : `${days} days`
  }
  if (minutes > 0 && minutes % 60 === 0) {
    const hours = minutes / 60
    return hours === 1 ? '1 hour' : `${hours} hours`
  }
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}

/** The freshness rule. A stale result also says this answer is past the window. */
export function outcomeFreshnessDisclosure(state: CustomerOutcomeState, staleAfterMinutes: number): string {
  const rule = `A result stays current for ${freshnessDuration(staleAfterMinutes)}.`
  if (state !== 'STALE') return rule
  return `${rule} This result is past that window.`
}

export function outcomeCoverageLabel(
  environment: string,
  bindings: Array<{ key: string; required: boolean }>,
): string {
  const required = bindings.filter((binding) => binding.required)
  if (required.length === 0) return 'Not configured for independent verification'
  const place = environment === 'production' ? 'Production' : environment
  const names = required.map((binding) => {
    if (binding.key.includes('checkout')) return 'purchase path'
    if (binding.key.includes('signup') || binding.key.includes('form')) return 'form'
    if (binding.key.includes('availability')) return 'page availability'
    return 'required check'
  })
  return `${place} · ${[...new Set(names)].join(', ')}`
}

/** Customer name for one verification method. Mechanism enums stay off the proof card. */
export function customerMechanismLabel(mechanism: string, key: string): string {
  if (key.includes('checkout')) return 'Purchase path'
  if (key.includes('signup') || key.includes('form') || mechanism === 'SAFE_FORM') return 'Form'
  if (key.includes('availability') || mechanism === 'HTTP_AVAILABILITY') return 'Page availability'
  return 'Check'
}

export function currentOutcomeState(
  assessment: { state: OutcomeAssessmentState; validUntil: Date } | null,
  now = new Date(),
): CustomerOutcomeState {
  if (!assessment) return 'COULD_NOT_VERIFY'
  if (assessment.state === 'COULD_NOT_VERIFY') return 'COULD_NOT_VERIFY'
  if (assessment.validUntil.getTime() <= now.getTime()) return 'STALE'
  return assessment.state
}

export function checkoutResultCopy(reason: string): {
  summary: string
  problem: string
  evidence: string
  fix: string
} {
  switch (reason) {
    case 'checkout_reached':
      return {
        summary: 'FixFlags independently reached checkout.',
        problem: '',
        evidence: 'The purchase path added the selected product and reached checkout.',
        fix: '',
      }
    case 'add_to_cart_noop':
      return {
        summary: 'Add to cart did not update the cart.',
        problem: 'Cart did not contain the selected product after Add to cart.',
        evidence:
          'FixFlags repeated the purchase path and the cart did not update after either attempt.',
        fix: 'Repair the Add to cart action and confirm that the selected variant appears in the cart.',
      }
    case 'buy_control_unclickable':
      return {
        summary: 'The purchase control could not be used.',
        problem: 'The primary purchase control could not be clicked.',
        evidence:
          'FixFlags found the purchase control but could not activate it in two independent attempts.',
        fix: 'Remove the blocker or broken handler so a customer can activate the purchase control.',
      }
    case 'checkout_error':
      return {
        summary: 'Checkout showed an error.',
        problem: 'Checkout displayed an error before the customer could continue.',
        evidence: 'FixFlags repeated the purchase path and observed the checkout error both times.',
        fix: 'Repair the checkout configuration or integration, then repeat the same purchase path.',
      }
    case 'http_error':
      return {
        summary: 'The purchase path was unavailable.',
        problem: 'A required purchase page returned an unavailable response.',
        evidence: 'FixFlags reproduced the unavailable purchase path in two independent attempts.',
        fix: 'Restore the failed product, cart, or checkout page and verify the purchase path again.',
      }
    case 'flaky':
      return {
        summary: 'Checkout behaved inconsistently, so FixFlags could not verify it.',
        problem: '',
        evidence: 'The repeated purchase attempts produced different results.',
        fix: '',
      }
    case 'bot_wall':
      return {
        summary: 'Bot protection prevented a trustworthy checkout verification.',
        problem: '',
        evidence: 'The independent browser was stopped by a bot challenge.',
        fix: '',
      }
    case 'password_gate':
      return {
        summary: 'Checkout is protected and could not be verified with the current access.',
        problem: '',
        evidence: 'The purchase path required credentials that were not available to this run.',
        fix: '',
      }
    case 'no_buy_control':
      return {
        summary: 'FixFlags could not find a safe purchase control to exercise.',
        problem: '',
        evidence: 'No supported Add to cart or Buy control was available on the bound page.',
        fix: '',
      }
    case 'timeout':
      return {
        summary: 'Checkout did not finish before the verification deadline.',
        problem: '',
        evidence:
          'The independent browser timed out before it could reach a trustworthy conclusion.',
        fix: '',
      }
    default:
      return {
        summary: 'FixFlags could not reach a trustworthy checkout conclusion.',
        problem: '',
        evidence: 'The independent browser did not produce comparable checkout evidence.',
        fix: '',
      }
  }
}

/** Next step when Checkout could not be verified. Confirmed failures stay on the Flag. */
export function checkoutCouldNotVerifyRecovery(reason: string | null | undefined): string {
  switch (reason) {
    case 'no_buy_control':
      return 'Check a page that has Add to cart or Buy, then verify again.'
    case 'bot_wall':
      return 'Verify again when the independent browser can pass the challenge.'
    case 'password_gate':
      return 'Provide access for this checkout, then verify again.'
    case 'timeout':
      return 'Verify again. The last check reached the time limit.'
    case 'flaky':
      return 'Verify again. The repeated purchase attempts did not agree.'
    default:
      return 'Verify again.'
  }
}

/** Next step when a page could not be verified. A failed response stays on the Flag. */
export function availabilityCouldNotVerifyRecovery(reason: string | null | undefined): string {
  switch (reason) {
    case 'not_public':
      return 'Use a public page address, then verify again.'
    case 'redirect_unfollowed':
      return 'Use the page that answers directly, then verify again.'
    case 'bot_wall':
      return 'Verify again when a public request can pass the challenge.'
    case 'rendered_surface_unavailable':
      return 'Verify again. The last check had no rendered page to read.'
    case 'request_failed':
      return 'Verify again. The last request did not complete.'
    default:
      return 'Verify again.'
  }
}

/** Customer wording for one binding result. Checkout keeps its purchase sentences. */
export function customerBindingResult(input: {
  key: string
  disposition: string
  reason: string
}): { headline: string; detail: string | null } {
  if (input.key.includes('checkout')) {
    const copy = checkoutResultCopy(input.disposition === 'SUCCEEDED' ? 'checkout_reached' : input.reason)
    return { headline: copy.summary, detail: copy.evidence || null }
  }
  const state = input.disposition === 'SUCCEEDED'
    ? 'CLEAR'
    : input.disposition === 'FAILED'
      ? 'FLAG'
      : 'COULD_NOT_VERIFY'
  return { headline: summaryFor(input.reason, state), detail: null }
}
