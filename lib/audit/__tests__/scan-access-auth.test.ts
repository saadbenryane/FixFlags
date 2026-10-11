import { describe, expect, it } from 'vitest'
import { canUseEphemeralScanAccess } from '@/lib/audit/scan-access-auth'

describe('canUseEphemeralScanAccess', () => {
  it('requires authentication and includes supported beta scan access', () => {
    expect(canUseEphemeralScanAccess(null)).toBe(false)
    expect(
      canUseEphemeralScanAccess({
        id: 'u1',
        role: 'user',
        plan: 'BUILDER',
        subscriptionStatus: 'ACTIVE',
      })
    ).toBe(true)
    expect(
      canUseEphemeralScanAccess({
        id: 'u1',
        role: 'user',
        plan: 'TEAM',
        subscriptionStatus: 'ACTIVE',
      })
    ).toBe(true)
  })
})
