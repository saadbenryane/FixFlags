import { describe, expect, it } from 'vitest'
import {
  getEffectiveDeepReviewLimit,
  isAtDeepReviewLimit,
  wouldBlockDeepReview,
} from '@/lib/billing/deep-review-limit'

describe('getEffectiveDeepReviewLimit', () => {
  it('returns infinity for admins', () => {
    expect(
      getEffectiveDeepReviewLimit({ plan: 'FREE', role: 'admin', deepReviewsLimit: 1 })
    ).toBe(Number.POSITIVE_INFINITY)
  })

  it('returns the stored limit for regular users', () => {
    expect(
      getEffectiveDeepReviewLimit({ plan: 'FREE', role: 'user', deepReviewsLimit: 4 })
    ).toBe(4)
  })

  it('falls back to the plan default when the stored limit is unset', () => {
    expect(
      getEffectiveDeepReviewLimit({
        plan: 'FREE',
        role: 'user',
        deepReviewsLimit: undefined as never,
      })
    ).toBe(1)
    expect(
      getEffectiveDeepReviewLimit({
        plan: 'BUILDER',
        role: 'user',
        deepReviewsLimit: undefined as never,
      })
    ).toBe(3)
    expect(
      getEffectiveDeepReviewLimit({
        plan: 'TEAM',
        role: 'user',
        deepReviewsLimit: undefined as never,
      })
    ).toBe(10)
  })
})

describe('isAtDeepReviewLimit', () => {
  it('blocks when used reaches the finite limit', () => {
    expect(isAtDeepReviewLimit(3, 3)).toBe(true)
    expect(isAtDeepReviewLimit(4, 3)).toBe(true)
    expect(isAtDeepReviewLimit(2, 3)).toBe(false)
  })

  it('never blocks an unlimited quota', () => {
    expect(isAtDeepReviewLimit(100, Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe('wouldBlockDeepReview', () => {
  const baseUser = {
    id: 'user-1',
    plan: 'FREE' as const,
    role: 'user' as const,
    deepReviewsUsed: 1,
    deepReviewsLimit: 1,
  }

  it('never blocks admins', () => {
    expect(wouldBlockDeepReview({ ...baseUser, role: 'admin' })).toBe(false)
  })

  it('blocks a regular user at their deep-review limit', () => {
    expect(wouldBlockDeepReview(baseUser)).toBe(true)
  })

  it('allows a regular user under their deep-review limit', () => {
    expect(wouldBlockDeepReview({ ...baseUser, deepReviewsUsed: 0 })).toBe(false)
  })
})
