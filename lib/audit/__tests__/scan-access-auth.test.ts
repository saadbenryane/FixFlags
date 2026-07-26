import { describe, expect, it } from 'vitest'
import { canUseEphemeralScanAccess } from '@/lib/audit/scan-access-auth'

describe('canUseEphemeralScanAccess', () => {
  it('requires an authenticated Studio user', () => {
    expect(canUseEphemeralScanAccess(null)).toBe(false)
    expect(
      canUseEphemeralScanAccess({
        id: 'u1',
        role: 'user',
        plan: 'BUILDER',
        subscriptionStatus: 'ACTIVE',
      })
    ).toBe(false)
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
