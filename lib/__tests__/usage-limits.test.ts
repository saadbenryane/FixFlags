import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canAccessRecheck,
  canExportSummary,
  canSharePublicly,
  getEntitlements,
} from '@/lib/auth/entitlements'
import { scanLimitForPlan } from '@/lib/billing/plans'
import { ANON_AUDIT_LIMIT } from '@/lib/audit/usage'

describe('product contract limits', () => {
  it('anonymous users get one free check', () => {
    assert.equal(ANON_AUDIT_LIMIT, 1)
  })

  it('free plan has 3 lifetime new URL checks', () => {
    assert.equal(scanLimitForPlan('FREE'), 3)
  })

  it('pro plan has 25 monthly checks', () => {
    assert.equal(scanLimitForPlan('BUILDER'), 25)
  })

  it('agency plan has 100 monthly checks', () => {
    assert.equal(scanLimitForPlan('TEAM'), 100)
  })
})

describe('share and export entitlements', () => {
  const freeUser = { id: 'u1', role: 'user' as const, plan: 'FREE' as const }
  const proUser = { id: 'u2', role: 'user' as const, plan: 'BUILDER' as const }
  const agencyUser = { id: 'u3', role: 'user' as const, plan: 'TEAM' as const }

  it('denies public share for free and pro', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(canSharePublicly(freeUser), false)
    assert.equal(canSharePublicly(proUser), false)
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('allows public share for agency', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(canSharePublicly(agencyUser), true)
    assert.equal(canExportSummary(agencyUser), true)
    delete process.env.DEV_SIMULATE_BILLING
  })
})

describe('re-check entitlements', () => {
  it('allows re-check for free users without trial gating', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    const entitlements = getEntitlements({
      id: 'u1',
      role: 'user',
      plan: 'FREE',
      freeRecheckUsedAt: null,
    })
    assert.equal(entitlements.canRecheck, true)
    assert.equal(entitlements.canUseFreeRecheck, false)
    assert.equal(canAccessRecheck({
      id: 'u1',
      role: 'user',
      plan: 'FREE',
      freeRecheckUsedAt: null,
    }), true)
    delete process.env.DEV_SIMULATE_BILLING
  })
})
