import type { OutcomeAssessmentState } from '@prisma/client'

export type CustomerOutcomeState = 'CLEAR' | 'FLAG' | 'COULD_NOT_VERIFY' | 'STALE'

export function currentOutcomeState(
  assessment: { state: OutcomeAssessmentState; validUntil: Date } | null,
  now = new Date(),
): CustomerOutcomeState {
  if (!assessment) return 'COULD_NOT_VERIFY'
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
