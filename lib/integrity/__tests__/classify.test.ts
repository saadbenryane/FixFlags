import { describe, expect, it } from 'vitest'
import { classifyWalk, combineAttempts, combinePathAttempts, goalProbeReason } from '@/lib/integrity/classify'
import type { PathProbeAttempt, WalkOutcome } from '@/lib/integrity/types'

function outcome(overrides: Partial<WalkOutcome> = {}): WalkOutcome {
  return {
    reachedCheckout: false,
    httpStatus: 200,
    buyControlFound: true,
    buyControlClicked: true,
    cartUpdated: true,
    checkoutErrorVisible: false,
    botWall: false,
    passwordGate: false,
    timedOut: false,
    pageUnavailable: false,
    failedStep: 'checkout',
    ...overrides,
  }
}

describe('classifyWalk', () => {
  it('keeps scanner-imposed submission refusal unknown without concealing a real HTTP failure', () => {
    expect(classifyWalk(outcome({ safetyRefused: true, cartUpdated: false }))).toEqual({ health: 'UNKNOWN', reason: 'safety_boundary' })
    expect(classifyWalk(outcome({ safetyRefused: true, httpStatus: 404, pageUnavailable: true })))
      .toEqual({ health: 'RED', reason: 'http_error' })
  })
  it('is GREEN when checkout is reached', () => {
    expect(classifyWalk(outcome({ reachedCheckout: true, failedStep: null }))).toEqual({
      health: 'GREEN',
      reason: 'checkout_reached',
    })
  })

  it('is RED when add to cart does nothing', () => {
    expect(
      classifyWalk(outcome({ buyControlClicked: true, cartUpdated: false, reachedCheckout: false }))
    ).toEqual({ health: 'RED', reason: 'add_to_cart_noop' })
  })

  it('is RED on 404 landing', () => {
    expect(classifyWalk(outcome({ httpStatus: 404, pageUnavailable: true }))).toEqual({
      health: 'RED',
      reason: 'http_error',
    })
  })

  it('is UNKNOWN when no buy control exists', () => {
    expect(classifyWalk(outcome({ buyControlFound: false, buyControlClicked: false }))).toEqual({
      health: 'UNKNOWN',
      reason: 'no_buy_control',
    })
  })

  it('is UNKNOWN on bot walls', () => {
    expect(classifyWalk(outcome({ botWall: true }))).toEqual({
      health: 'UNKNOWN',
      reason: 'bot_wall',
    })
  })
})

describe('combineAttempts', () => {
  it('confirms RED only after a second RED', () => {
    const once = combineAttempts({ health: 'RED', reason: 'add_to_cart_noop' }, null)
    expect(once.confirmed).toBe(false)
    const twice = combineAttempts(
      { health: 'RED', reason: 'add_to_cart_noop' },
      { health: 'RED', reason: 'add_to_cart_noop' }
    )
    expect(twice).toMatchObject({ health: 'RED', confirmed: true })
  })

  it('marks mixed RED then GREEN as flaky UNKNOWN', () => {
    expect(
      combineAttempts(
        { health: 'RED', reason: 'add_to_cart_noop' },
        { health: 'GREEN', reason: 'checkout_reached' }
      )
    ).toEqual({ health: 'UNKNOWN', reason: 'flaky', confirmed: false })
  })
})

describe('checkout failure confirmation', () => {
  const failedCheckout: PathProbeAttempt = {
    outcome: outcome({ httpStatus: 503, purchaseControlKey: 'a'.repeat(64) }),
    steps: [{ label: 'failure', url: 'https://store.example/product',
      destinationUrl: 'https://store.example/checkout', screenshotUrl: null }],
    finalUrl: 'https://store.example/product', videoUrl: null, gifUrl: null,
  }

  it('confirms repeated failure at the same embedded checkout', () => {
    expect(combinePathAttempts(failedCheckout, failedCheckout))
      .toEqual({ health: 'RED', reason: 'http_error', confirmed: true })
  })

  it.each([
    { ...failedCheckout, outcome: outcome({ checkoutErrorVisible: true }) },
    { ...failedCheckout, outcome: outcome({ httpStatus: 503, failedStep: 'landing' }) },
    { ...failedCheckout, outcome: { ...failedCheckout.outcome, purchaseControlKey: 'b'.repeat(64) } },
    { ...failedCheckout, steps: [{ ...failedCheckout.steps[0], destinationUrl: 'https://store.example/other-checkout' }] },
  ])('keeps different failures inconclusive even when both attempts fail', second => {
    expect(combinePathAttempts(failedCheckout, second))
      .toEqual({ health: 'UNKNOWN', reason: 'flaky', confirmed: false })
  })
})

describe('goalProbeReason', () => {
  it('does not label a generic successful goal as checkout', () => {
    const green = { health: 'GREEN' as const, reason: 'checkout_reached' as const }
    expect(goalProbeReason(green, 'reversible')).toBe('goal_reached')
    expect(goalProbeReason(green, 'none')).toBe('goal_reached')
    expect(goalProbeReason(green, 'stop-at-checkout')).toBe('checkout_reached')
  })

  it('preserves blocked and failed reasons', () => {
    expect(goalProbeReason({ health: 'UNKNOWN', reason: 'bot_wall' }, 'reversible')).toBe('bot_wall')
    expect(goalProbeReason({ health: 'RED', reason: 'http_error' }, 'reversible')).toBe('http_error')
  })
})
