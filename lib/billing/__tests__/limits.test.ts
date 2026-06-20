import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { computePlanLimitUpdate } from '@/lib/billing/limits'
import { UNLIMITED_SCAN_LIMIT } from '@/lib/auth/permissions'

describe('computePlanLimitUpdate', () => {
  it('sets admin users to unlimited', () => {
    const update = computePlanLimitUpdate(
      { role: 'admin', auditsUsed: 10, auditsLimit: 3 },
      'FREE'
    )
    assert.equal(update?.auditsLimit, UNLIMITED_SCAN_LIMIT)
    assert.equal(update?.auditsUsed, 10)
  })

  it('sets free plan to 3 lifetime checks', () => {
    const update = computePlanLimitUpdate(
      { role: 'user', auditsUsed: 0, auditsLimit: 25 },
      'FREE'
    )
    assert.equal(update?.auditsLimit, 3)
    assert.equal(update?.auditsUsed, 0)
  })

  it('caps used count when downgrading', () => {
    const update = computePlanLimitUpdate(
      { role: 'user', auditsUsed: 20, auditsLimit: 25 },
      'FREE'
    )
    assert.equal(update?.auditsLimit, 3)
    assert.equal(update?.auditsUsed, 3)
  })
})
