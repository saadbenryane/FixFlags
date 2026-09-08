import type { PathHealth, PathReasonCode, WalkOutcome } from './types'

export interface ClassifiedWalk {
  health: PathHealth
  reason: PathReasonCode
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
  if (outcome.reachedCheckout) return { health: 'GREEN', reason: 'checkout_reached' }
  if (outcome.checkoutErrorVisible) return { health: 'RED', reason: 'checkout_error' }
  if (outcome.buyControlFound && !outcome.buyControlClicked) {
    return { health: 'RED', reason: 'buy_control_unclickable' }
  }
  if (outcome.buyControlClicked && !outcome.cartUpdated && !outcome.reachedCheckout) {
    return { health: 'RED', reason: 'add_to_cart_noop' }
  }
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

function isHardHttpFailure(status: number | null): boolean {
  if (status === null) return false
  return status === 404 || status === 410 || status >= 500
}
