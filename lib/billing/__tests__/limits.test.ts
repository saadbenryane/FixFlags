import { describe, expect, it, vi } from 'vitest'
import assert from 'node:assert/strict'
import { applyPlanLimits, computePlanLimitUpdate } from '@/lib/billing/limits'
import { UNLIMITED_SCAN_LIMIT } from '@/lib/auth/permissions'

describe('computePlanLimitUpdate', () => {
  it('sets admin users to unlimited', () => {
    const update = computePlanLimitUpdate(
      { role: 'admin', auditsUsed: 10, auditsLimit: 3, deepReviewsUsed: 2, deepReviewsLimit: 1 },
      'FREE'
    )
    assert.equal(update?.auditsLimit, UNLIMITED_SCAN_LIMIT)
    assert.equal(update?.auditsUsed, 10)
  })

  it('sets free plan to 3 lifetime checks', () => {
    const update = computePlanLimitUpdate(
      { role: 'user', auditsUsed: 0, auditsLimit: 25, deepReviewsUsed: 0, deepReviewsLimit: 10 },
      'FREE'
    )
    assert.equal(update?.auditsLimit, 3)
    assert.equal(update?.auditsUsed, 0)
  })

  it('caps used count when downgrading', () => {
    const update = computePlanLimitUpdate(
      { role: 'user', auditsUsed: 20, auditsLimit: 25, deepReviewsUsed: 5, deepReviewsLimit: 10 },
      'FREE'
    )
    assert.equal(update?.auditsLimit, 3)
    assert.equal(update?.auditsUsed, 3)
  })

  it('caps deep review usage when downgrading to a smaller deep quota', () => {
    const update = computePlanLimitUpdate(
      { role: 'user', auditsUsed: 2, auditsLimit: 3, deepReviewsUsed: 9, deepReviewsLimit: 10 },
      'BUILDER'
    )
    assert.equal(update?.deepReviewsLimit, 4)
    assert.equal(update?.deepReviewsUsed, 4)
  })

  it('keeps used counts when upgrading to unlimited', () => {
    const update = computePlanLimitUpdate(
      { role: 'user', auditsUsed: 12, auditsLimit: 25, deepReviewsUsed: 3, deepReviewsLimit: 4 },
      'TEAM'
    )
    assert.equal(update?.auditsLimit, 80)
    assert.equal(update?.auditsUsed, 12)
    assert.equal(update?.deepReviewsLimit, 10)
    assert.equal(update?.deepReviewsUsed, 3)
  })
})

describe('applyPlanLimits', () => {
  const user = {
    id: 'user-1',
    role: 'user',
    auditsLimit: 25,
    auditsUsed: 20,
    deepReviewsLimit: 10,
    deepReviewsUsed: 5,
  }

  it('skips the update when the user does not exist', async () => {
    const client = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
    }
    await applyPlanLimits('missing', 'FREE', client as never)
    assert.equal(client.user.update.mock.calls.length, 0)
  })

  it('applies the computed limits to the user row', async () => {
    const client = {
      user: {
        findUnique: vi.fn().mockResolvedValue(user),
        update: vi.fn().mockResolvedValue({}),
      },
    }
    await applyPlanLimits('user-1', 'FREE', client as never)
    expect(client.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        plan: 'FREE',
        auditsLimit: 3,
        auditsUsed: 3,
        deepReviewsLimit: 1,
        deepReviewsUsed: 1,
      },
    })
  })

  it('sets admin users to unlimited limits', async () => {
    const client = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ ...user, role: 'admin' }),
        update: vi.fn().mockResolvedValue({}),
      },
    }
    await applyPlanLimits('admin-1', 'FREE', client as never)
    expect(client.user.update).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      data: {
        plan: 'FREE',
        auditsLimit: UNLIMITED_SCAN_LIMIT,
        auditsUsed: 20,
        deepReviewsLimit: UNLIMITED_SCAN_LIMIT,
        deepReviewsUsed: 5,
      },
    })
  })
})
