import { describe, expect, it } from 'vitest'
import {
  UNLIMITED_SCAN_LIMIT,
  checkUsageProgress,
  isAtCheckLimit,
  isUnlimitedScanLimit,
  limitErrorCodeForPlan,
} from '@/lib/audit/check-limit-utils'

describe('isUnlimitedScanLimit', () => {
  it('recognizes the sentinel value', () => {
    expect(isUnlimitedScanLimit(UNLIMITED_SCAN_LIMIT)).toBe(true)
    expect(isUnlimitedScanLimit(0)).toBe(false)
    expect(isUnlimitedScanLimit(25)).toBe(false)
  })
})

describe('isAtCheckLimit', () => {
  it('never blocks when the limit is unset or unlimited', () => {
    expect(isAtCheckLimit(0, 0, null)).toBe(false)
    expect(isAtCheckLimit(99, 99, Infinity)).toBe(false)
    expect(isAtCheckLimit(99, 99, UNLIMITED_SCAN_LIMIT)).toBe(false)
  })

  it('blocks when used plus pending reach the limit', () => {
    expect(isAtCheckLimit(3, 0, 3)).toBe(true)
    expect(isAtCheckLimit(2, 1, 3)).toBe(true)
    expect(isAtCheckLimit(2, 0, 3)).toBe(false)
  })
})

describe('checkUsageProgress', () => {
  it('reports unlimited usage without a percentage', () => {
    expect(checkUsageProgress(4, 2, null)).toEqual({ atLimit: false, pct: 0, reserved: 6 })
    expect(checkUsageProgress(4, 2, Infinity)).toEqual({ atLimit: false, pct: 0, reserved: 6 })
    expect(checkUsageProgress(4, 2, UNLIMITED_SCAN_LIMIT)).toEqual({
      atLimit: false,
      pct: 0,
      reserved: 6,
    })
  })

  it('computes a rounded percentage of reserved capacity', () => {
    expect(checkUsageProgress(1, 0, 3)).toEqual({ atLimit: false, pct: 33, reserved: 1 })
    expect(checkUsageProgress(2, 1, 3)).toEqual({ atLimit: true, pct: 100, reserved: 3 })
    expect(checkUsageProgress(5, 0, 3)).toEqual({ atLimit: true, pct: 100, reserved: 5 })
  })
})

describe('limitErrorCodeForPlan', () => {
  it('asks free users to upgrade and paid users to buy credits', () => {
    expect(limitErrorCodeForPlan('FREE')).toBe('UPGRADE_REQUIRED')
    expect(limitErrorCodeForPlan('BUILDER')).toBe('TOKEN_LIMIT')
    expect(limitErrorCodeForPlan('TEAM')).toBe('TOKEN_LIMIT')
  })
})
