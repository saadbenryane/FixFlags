import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canSharePublicly } from '@/lib/auth/entitlements'

describe('toggle-public gating', () => {
  it('allows agency users to share publicly', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(
      canSharePublicly({ id: 'u1', role: 'user', plan: 'TEAM' }),
      true
    )
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('denies pro users public share', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(
      canSharePublicly({ id: 'u1', role: 'user', plan: 'BUILDER' }),
      false
    )
    delete process.env.DEV_SIMULATE_BILLING
  })
})
