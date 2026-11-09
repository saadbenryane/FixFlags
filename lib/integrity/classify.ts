import type { PathHealth, PathProbeAttempt, PathReasonCode, WalkOutcome } from './types'

export interface ClassifiedWalk {
  health: PathHealth
  reason: PathReasonCode
}

export function goalProbeReason(
  classified: ClassifiedWalk,
  safety: 'none' | 'stop-at-checkout' | 'reversible' | undefined,
): PathReasonCode {
  return classified.health === 'GREEN' && safety !== 'stop-at-checkout'
    ? 'goal_reached'
    : classified.reason
}

export function classifyWalk(outcome: WalkOutcome): ClassifiedWalk {
  if (outcome.botWall) return { health: 'UNKNOWN', reason: 'bot_wall' }
  if (outcome.passwordGate) return { health: 'UNKNOWN', reason: 'password_gate' }
  if (outcome.timedOut && !outcome.buyControlClicked) {
    return { health: 'UNKNOWN', reason: 'timeout' }
  }
  if (outcome.pageUnavailable || isHardHttpFailure(outcome.httpStatus)) {
    return { health: 'RED', reason: 'http_error' }
  }
  if (outcome.safetyRefused && !outcome.reachedCheckout) return { health: 'UNKNOWN', reason: 'safety_boundary' }
  if (outcome.checkoutErrorVisible) return { health: 'RED', reason: 'checkout_error' }
  if (outcome.httpStatus !== null && outcome.httpStatus >= 400) return { health: 'UNKNOWN', reason: 'probe_error' }
  if (outcome.reachedCheckout) return { health: 'GREEN', reason: 'checkout_reached' }
  if (outcome.checkoutSurfaceUnavailable) return { health: 'UNKNOWN', reason: 'checkout_surface_unavailable' }
  if (outcome.buyControlFound && !outcome.buyControlClicked) {
    return { health: 'RED', reason: 'buy_control_unclickable' }
  }
  if (outcome.buyControlClicked && !outcome.cartUpdated && !outcome.reachedCheckout) {
    return { health: 'RED', reason: 'add_to_cart_noop' }
  }
  if (outcome.originalPurchaseControlUnavailable) return { health: 'UNKNOWN', reason: 'original_purchase_control_unavailable' }
  if (!outcome.buyControlFound) return { health: 'UNKNOWN', reason: 'no_buy_control' }
  return { health: 'UNKNOWN', reason: 'probe_error' }
}

export function combineAttempts(
  first: ClassifiedWalk,
  second: ClassifiedWalk | null
): ClassifiedWalk & { confirmed: boolean } {
  if (!second) {
    return {
      ...first,
      confirmed: first.health !== 'RED',
    }
  }
  if (first.health === 'RED' && second.health === 'RED') {
    return { health: 'RED', reason: second.reason, confirmed: true }
  }
  if (first.health === 'RED' && second.health === 'GREEN') {
    return { health: 'UNKNOWN', reason: 'flaky', confirmed: false }
  }
  if (second.health === 'GREEN') {
    return { health: 'GREEN', reason: 'checkout_reached', confirmed: true }
  }
  return { ...second, confirmed: false }
}

export function combinePathAttempts(first: PathProbeAttempt, second: PathProbeAttempt | null) {
  const initial = classifyWalk(first.outcome)
  if (!second) return combineAttempts(initial, null)
  const confirmation = classifyWalk(second.outcome)
  if (initial.health === 'RED' && confirmation.health === 'RED') {
    const firstDestination = first.steps.at(-1)?.destinationUrl ?? first.finalUrl
    const secondDestination = second.steps.at(-1)?.destinationUrl ?? second.finalUrl
    if (initial.reason !== confirmation.reason || first.outcome.failedStep !== second.outcome.failedStep ||
      firstDestination !== secondDestination || first.outcome.purchaseControlKey !== second.outcome.purchaseControlKey)
      return { health: 'UNKNOWN', reason: 'flaky', confirmed: false } as const
  }
  return combineAttempts(initial, confirmation)
}

function isHardHttpFailure(status: number | null): boolean {
  if (status === null) return false
  return status === 404 || status === 410 || status >= 500
}
