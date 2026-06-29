import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  isAtCheckLimit,
  checkUsageProgress,
  wouldBlockNewCheck,
} from '@/lib/audit/check-limit'
import { resolveIncludeAiForNewAudit, remainingAiReportCredits } from '@/lib/audit/ai-report-entitlement'
import { scanLimitForPlan } from '@/lib/billing/plans'
import {
  canAccessRecheck,
  canExportSummary,
  canSharePublicly,
  getEntitlements,
} from '@/lib/auth/entitlements'
import {
  canViewAiReportContent,
  stripAiFromFlags,
} from '@/lib/audit/report-access'

describe('product contract limits', () => {
  it('anonymous new audits skip AI review', async () => {
    assert.equal(await resolveIncludeAiForNewAudit(null), false)
  })

  it('free plan has 3 lifetime AI reports', () => {
    assert.equal(scanLimitForPlan('FREE'), 3)
  })

  it('remaining AI credits subtracts used from limit', async () => {
    const total = await remainingAiReportCredits({ id: 'test-user', auditsUsed: 1, auditsLimit: 3, role: 'user' })
    assert.equal(total, 2)
    const total2 = await remainingAiReportCredits({ id: 'test-user-2', auditsUsed: 3, auditsLimit: 3, role: 'user' })
    assert.equal(total2, 0)
  })

  it('pro plan has 25 monthly checks', () => {
    assert.equal(scanLimitForPlan('BUILDER'), 25)
  })

  it('max plan has 100 monthly checks', () => {
    assert.equal(scanLimitForPlan('TEAM'), 100)
  })
})

describe('AI report access', () => {
  it('blocks AI content without aiReviewAt', () => {
    assert.equal(
      canViewAiReportContent({ userId: 'u1', aiReviewAt: null }, { id: 'u1' }),
      false
    )
  })

  it('allows AI content for owner after review', () => {
    assert.equal(
      canViewAiReportContent(
        { userId: 'u1', aiReviewAt: new Date() },
        { id: 'u1' }
      ),
      true
    )
  })

  it('strips AI flags when gating', () => {
    const stripped = stripAiFromFlags([
      { source: 'AI', problem: 'ai issue' },
      { source: 'DETERMINISTIC', problem: 'det issue', agentPrompt: 'prompt' },
    ])
    assert.equal(stripped.length, 1)
    assert.equal(stripped[0].problem, 'det issue')
    assert.equal(stripped[0].agentPrompt, null)
  })
})

describe('isAtCheckLimit', () => {
  it('includes pending checks against limit', () => {
    assert.equal(isAtCheckLimit(2, 1, 3), true)
    assert.equal(isAtCheckLimit(2, 0, 3), false)
  })
})

describe('checkUsageProgress', () => {
  it('reserves pending against limit for progress', () => {
    const progress = checkUsageProgress(2, 1, 3)
    assert.equal(progress.atLimit, true)
    assert.equal(progress.pct, 100)
    assert.equal(progress.reserved, 3)
  })
})

describe('wouldBlockNewCheck', () => {
  it('returns UPGRADE_REQUIRED for free users at cap', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    const result = wouldBlockNewCheck(
      { id: 'u1', plan: 'FREE', role: 'user', auditsUsed: 3, auditsLimit: 3 },
      0
    )
    assert.equal(result.allowed, false)
    assert.equal(result.code, 'UPGRADE_REQUIRED')
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('returns TOKEN_LIMIT for paid users at cap', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    const result = wouldBlockNewCheck(
      { id: 'u2', plan: 'BUILDER', role: 'user', auditsUsed: 25, auditsLimit: 25 },
      0
    )
    assert.equal(result.allowed, false)
    assert.equal(result.code, 'TOKEN_LIMIT')
    delete process.env.DEV_SIMULATE_BILLING
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

  it('allows public share for max', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(canSharePublicly(agencyUser), true)
    assert.equal(canExportSummary(agencyUser), true)
    delete process.env.DEV_SIMULATE_BILLING
  })
})

describe('re-check entitlements', () => {
  it('allows re-check for free users', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    const entitlements = getEntitlements({
      id: 'u1',
      role: 'user',
      plan: 'FREE',
    })
    assert.equal(entitlements.canRecheck, true)
    assert.equal(canAccessRecheck(), true)
    delete process.env.DEV_SIMULATE_BILLING
  })
})
