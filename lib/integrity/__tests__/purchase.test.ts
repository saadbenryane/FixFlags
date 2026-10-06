import { describe, expect, it } from 'vitest'
import {
  checkoutProbeVerdict,
  isTerminalOrderUrl,
  purchaseAttemptSucceeded,
  storedAttemptIsPurchaseWalk,
} from '@/lib/integrity/purchase'
import type { PathProbeResult, WalkOutcome } from '@/lib/integrity/types'

function outcome(overrides: Partial<WalkOutcome> = {}): WalkOutcome {
  return {
    reachedCheckout: false,
    httpStatus: 200,
    buyControlFound: false,
    buyControlClicked: false,
    cartUpdated: false,
    checkoutErrorVisible: false,
    botWall: false,
    passwordGate: false,
    timedOut: false,
    pageUnavailable: false,
    failedStep: null,
    ...overrides,
  }
}

function probe(overrides: Partial<PathProbeResult> = {}): PathProbeResult {
  return {
    health: 'GREEN',
    reason: 'checkout_reached',
    confirmed: true,
    attempts: [],
    steps: [],
    videoUrl: null,
    gifUrl: null,
    failedStep: null,
    finalUrl: 'https://shop.example/checkout',
    ...overrides,
  }
}

describe('purchase attempt', () => {
  it('succeeds only after a buy control reaches checkout', () => {
    const bought = outcome({ buyControlClicked: true, reachedCheckout: true, cartUpdated: true })
    expect(purchaseAttemptSucceeded(bought, 'https://shop.example/checkout')).toBe(true)
    expect(purchaseAttemptSucceeded(outcome({ reachedCheckout: true }), 'https://shop.example/checkout')).toBe(false)
    expect(purchaseAttemptSucceeded(bought, 'https://shop.example/checkout/thank-you')).toBe(false)
    expect(purchaseAttemptSucceeded(bought, 'https://shop.example/payment')).toBe(false)
    expect(purchaseAttemptSucceeded(bought, 'https://shop.example/orders/complete-order')).toBe(false)
  })

  it('does not treat an opening checkout URL as Clear', () => {
    const verdict = checkoutProbeVerdict(probe({
      attempts: [{
        outcome: outcome({ reachedCheckout: true }),
        steps: [{ label: 'checkout', url: 'https://shop.example/checkout', screenshotUrl: null }],
        videoUrl: null,
        gifUrl: null,
        finalUrl: 'https://shop.example/checkout',
      }],
    }))
    expect(verdict).toEqual({
      isClear: false,
      isFlag: false,
      reason: 'no_buy_control',
      disposition: 'BLOCKED',
    })
  })

  it('keeps a confirmed add-to-cart failure as a Flag and an unknown page off that Flag', () => {
    const failed = checkoutProbeVerdict(probe({
      health: 'RED',
      reason: 'add_to_cart_noop',
      confirmed: true,
      finalUrl: 'https://shop.example/products/widget',
      attempts: [{
        outcome: outcome({ buyControlFound: true, buyControlClicked: true }),
        steps: [],
        videoUrl: null,
        gifUrl: null,
        finalUrl: 'https://shop.example/products/widget',
      }],
    }))
    expect(failed).toMatchObject({ isFlag: true, isClear: false, disposition: 'FAILED', reason: 'add_to_cart_noop' })

    const unknown = checkoutProbeVerdict(probe({
      health: 'UNKNOWN',
      reason: 'no_buy_control',
      confirmed: false,
      finalUrl: 'https://shop.example/journal',
      attempts: [{
        outcome: outcome(),
        steps: [],
        videoUrl: null,
        gifUrl: null,
        finalUrl: 'https://shop.example/journal',
      }],
    }))
    expect(unknown).toMatchObject({ isFlag: false, isClear: false, disposition: 'BLOCKED', reason: 'no_buy_control' })
  })

  it('recognizes a stored buy and ignores a checkout label without one', () => {
    expect(storedAttemptIsPurchaseWalk([
      { actionType: 'add_to_cart', actionDetail: { label: 'add_to_cart' } },
    ])).toBe(true)
    expect(storedAttemptIsPurchaseWalk([
      { actionType: 'click', actionDetail: { text: 'Add to cart' } },
    ])).toBe(true)
    expect(storedAttemptIsPurchaseWalk([
      { actionType: 'navigate', actionDetail: { label: 'landing' } },
      { actionType: 'checkout', actionDetail: { label: 'checkout' } },
    ])).toBe(false)
    expect(storedAttemptIsPurchaseWalk([])).toBe(false)
  })

  it('recognizes payment, thank-you, and order-complete URLs', () => {
    expect(isTerminalOrderUrl('https://shop.example/checkout')).toBe(false)
    expect(isTerminalOrderUrl('https://shop.example/checkout/thank-you')).toBe(true)
    expect(isTerminalOrderUrl('https://shop.example/payment')).toBe(true)
    expect(isTerminalOrderUrl('https://shop.example/order-complete')).toBe(true)
  })
})
