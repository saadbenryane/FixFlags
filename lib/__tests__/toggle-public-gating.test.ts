import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { canSharePublicly } from '@/lib/auth/entitlements'

describe('toggle-public gating', () => {
  it('allows agency users to share publicly', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(
      canSharePublicly({ id: 'u1', role: 'user', plan: 'TEAM', subscriptionStatus: 'ACTIVE' }),
      true
    )
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('allows pro users public share', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(
      canSharePublicly({ id: 'u1', role: 'user', plan: 'BUILDER', subscriptionStatus: 'ACTIVE' }),
      true
    )
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('keeps sharing available when a Studio subscription has lapsed', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(
      canSharePublicly({ id: 'u1', role: 'user', plan: 'TEAM', subscriptionStatus: 'PAST_DUE' }),
      true
    )
    delete process.env.DEV_SIMULATE_BILLING
  })
})
