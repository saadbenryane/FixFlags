import { BUY_CONTROL_TEXT } from './buy-controls'
import { classifyWalk } from './classify'
import type { PathProbeAttempt, PathProbeResult, WalkOutcome } from './types'

/**
 * A payment, thank-you, or order-complete URL. Checkout verification stops
 * before an order, so landing here is not a successful purchase attempt.
 */
const TERMINAL_ORDER_URL =
  /(?:^|[/._-])(?:payment|payments|thank(?:-you|_you)?|thanks|order[-_]?complete|complete[-_]?order|order[-_]?confirmation)(?:[/._?-]|$)/i

export type CheckoutDisposition = 'SUCCEEDED' | 'FAILED' | 'BLOCKED'

export interface CheckoutProbeVerdict {
  isClear: boolean
  isFlag: boolean
  reason: string
  disposition: CheckoutDisposition
}

export interface StoredPurchaseStep {
  actionType?: string | null
  actionDetail?: unknown
  label?: string | null
  elementDescription?: string | null
}

/** Success is this attempt using a buy control and then reaching checkout. */
export function purchaseAttemptSucceeded(outcome: WalkOutcome, finalUrl: string | null | undefined): boolean {
  return Boolean(outcome.buyControlClicked && outcome.reachedCheckout &&
    classifyWalk(outcome).health === 'GREEN' && !isTerminalOrderUrl(finalUrl))
}

export function isTerminalOrderUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return TERMINAL_ORDER_URL.test(`${parsed.pathname}${parsed.search}`)
  } catch {
    return TERMINAL_ORDER_URL.test(url)
  }
}

/** A stored review is a purchase walk only when one of its steps used a buy control. */
export function storedAttemptIsPurchaseWalk(
  steps: readonly StoredPurchaseStep[] | null | undefined,
): boolean {
  return (steps ?? []).some(stepRecordsBuyAction)
}

export function stepRecordsBuyAction(step: StoredPurchaseStep): boolean {
  if (step.actionType === 'add_to_cart' || step.label === 'add_to_cart') return true
  const texts: string[] = []
  if (typeof step.elementDescription === 'string') texts.push(step.elementDescription)
  const detail = step.actionDetail
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const record = detail as Record<string, unknown>
    if (record.label === 'add_to_cart') return true
    for (const key of ['name', 'text', 'label', 'action'] as const) {
      const value = record[key]
      if (typeof value === 'string') texts.push(value)
    }
  }
  return texts.some((text) => BUY_CONTROL_TEXT.test(text))
}

/**
 * Clear only when the probe's own verdict is a confirmed purchase.
 * An opening checkout URL is green for the shared walk and is not Clear here.
 */
export function checkoutProbeVerdict(result: PathProbeResult): CheckoutProbeVerdict {
  const purchased =
    result.attempts.some((attempt) => purchaseAttemptSucceeded(attempt.outcome, attempt.finalUrl)) &&
    !isTerminalOrderUrl(result.finalUrl)
  if (result.health === 'GREEN' && result.confirmed && purchased) {
    return { isClear: true, isFlag: false, reason: 'checkout_reached', disposition: 'SUCCEEDED' }
  }
  if (result.health === 'RED' && result.confirmed) {
    return { isClear: false, isFlag: true, reason: result.reason, disposition: 'FAILED' }
  }
  const openedCheckoutWithoutBuying = result.health === 'GREEN' && !purchased
  return {
    isClear: false,
    isFlag: false,
    reason: openedCheckoutWithoutBuying ? 'no_buy_control' : result.reason,
    disposition: 'BLOCKED',
  }
}

export function checkoutAttemptObservation(attempt: PathProbeAttempt): {
  disposition: CheckoutDisposition
  reason: string
} {
  if (purchaseAttemptSucceeded(attempt.outcome, attempt.finalUrl)) {
    return { disposition: 'SUCCEEDED', reason: 'checkout_reached' }
  }
  const classified = classifyWalk(attempt.outcome)
  if (classified.health === 'GREEN') {
    return { disposition: 'BLOCKED', reason: 'no_buy_control' }
  }
  return {
    disposition: classified.health === 'RED' ? 'FAILED' : 'BLOCKED',
    reason: classified.reason,
  }
}
