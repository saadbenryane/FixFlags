import { describe, it, vi } from 'vitest'
import assert from 'node:assert/strict'

// These are pure-logic contract tests; they must run without a database (CI has
// no DATABASE_URL). The DB paths touched are the purchased-credit lookup behind
// getTotalAvailableCredits and the user/audit lookups in
// resolveIncludeAiForNewAudit, so stub them at the prisma boundary.
const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    creditPurchase: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { creditsRemaining: 0 } }),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    audit: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}))
import {
  isAtCheckLimit,
  checkUsageProgress,
  wouldBlockNewCheck,
} from '@/lib/audit/check-limit'
import { resolveIncludeAiForNewAudit, remainingAiReportCredits } from '@/lib/audit/ai-report-entitlement'
import { scanLimitForPlan } from '@/lib/billing/plans'
import {
  canAccessMonitoring,
  canAccessPaidFeatures,
  canExportSummary,
  canSharePublicly,
  getEntitlements,
  getReportTierForUser,
} from '@/lib/auth/entitlements'
import {
  canViewPrescriptionContent,
  stripPrescriptionFromFlags,
} from '@/lib/audit/report-access'

describe('product contract limits', () => {
  it('anonymous new audits skip AI review', async () => {
    assert.equal(await resolveIncludeAiForNewAudit(null), false)
  })

  it('denies AI for a paid plan whose subscription has lapsed, even with a stale high auditsLimit', async () => {
    // Simulates the exact gap: invoice.payment_failed sets subscriptionStatus
    // but never touches plan/auditsLimit, so auditsLimit can still read the
    // paid plan's quota (25) while the user is PAST_DUE/CANCELED/UNPAID.
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'lapsed-user',
      plan: 'BUILDER',
      role: 'user',
      auditsUsed: 0,
      auditsLimit: 25,
      subscriptionStatus: 'PAST_DUE',
    })
    assert.equal(await resolveIncludeAiForNewAudit('lapsed-user'), false)
  })

  it('still allows AI for an active paid plan under its limit', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'active-user',
      plan: 'BUILDER',
      role: 'user',
      auditsUsed: 0,
      auditsLimit: 25,
      subscriptionStatus: 'ACTIVE',
    })
    assert.equal(await resolveIncludeAiForNewAudit('active-user'), true)
  })

  it('still allows AI for a lapsed subscription if the user has purchased credit packs', async () => {
    // The plan's included quota is forfeited on a lapsed subscription (see the test
    // above), but a one-time credit pack is a distinct, already-paid-for transaction
    // and must remain spendable regardless of subscription state.
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.creditPurchase.aggregate).mockResolvedValueOnce({
      _sum: { creditsRemaining: 5 },
    } as never)
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'lapsed-user-with-credits',
      plan: 'BUILDER',
      role: 'user',
      auditsUsed: 0,
      auditsLimit: 25,
      subscriptionStatus: 'PAST_DUE',
    })
    assert.equal(await resolveIncludeAiForNewAudit('lapsed-user-with-credits'), true)
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

  it('pro plan has 5 monthly checks', () => {
    assert.equal(scanLimitForPlan('BUILDER'), 5)
  })

  it('studio plan has 25 monthly checks', () => {
    assert.equal(scanLimitForPlan('TEAM'), 25)
  })
})

describe('AI report access', () => {
  it('blocks AI content without aiReviewAt', () => {
    assert.equal(
      canViewPrescriptionContent({ userId: 'u1', aiReviewAt: null }, { id: 'u1' }),
      false
    )
  })

  it('allows AI content for owner after review', () => {
    assert.equal(
      canViewPrescriptionContent(
        { userId: 'u1', aiReviewAt: new Date() },
        { id: 'u1' }
      ),
      true
    )
  })

  it('strips prescription fields but keeps triage flag titles', () => {
    const stripped = stripPrescriptionFromFlags([
      { source: 'AI', problem: 'ai issue', agentPrompt: 'x' },
      { source: 'DETERMINISTIC', problem: 'det issue', agentPrompt: 'prompt' },
    ])
    assert.equal(stripped.length, 2)
    assert.equal(stripped[0]?.problem, 'ai issue')
    assert.equal(stripped[0]?.agentPrompt, null)
    assert.equal(stripped[1]?.agentPrompt, null)
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
    assert.equal(result.action, 'buy_credits')
    delete process.env.DEV_SIMULATE_BILLING
  })
})

describe('share and export entitlements', () => {
  const freeUser = { id: 'u1', role: 'user' as const, plan: 'FREE' as const, subscriptionStatus: 'NONE' as const }
  const proUser = { id: 'u2', role: 'user' as const, plan: 'BUILDER' as const, subscriptionStatus: 'ACTIVE' as const }
  const agencyUser = { id: 'u3', role: 'user' as const, plan: 'TEAM' as const, subscriptionStatus: 'ACTIVE' as const }

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

describe('monitoring entitlements', () => {
  it('allows monitoring for free users', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    const entitlements = getEntitlements({
      id: 'u1',
      role: 'user',
      plan: 'FREE',
      subscriptionStatus: 'NONE',
    })
    assert.equal(entitlements.canMonitor, true)
    assert.equal(canAccessMonitoring(), true)
    delete process.env.DEV_SIMULATE_BILLING
  })
})

describe('revoked subscription behavior', () => {
  const revokedStates = ['PAST_DUE', 'CANCELED', 'UNPAID'] as const

  for (const status of revokedStates) {
    it(`getReportTierForUser returns free for ${status}`, () => {
      process.env.DEV_SIMULATE_BILLING = 'true'
      const tier = getReportTierForUser({
        id: 'u',
        plan: 'BUILDER',
        role: 'user',
        subscriptionStatus: status,
      })
      assert.equal(tier, 'free')
      delete process.env.DEV_SIMULATE_BILLING
    })
  }

  for (const status of revokedStates) {
    it(`canAccessPaidFeatures returns false for ${status}`, () => {
      process.env.DEV_SIMULATE_BILLING = 'true'
      const paid = canAccessPaidFeatures({
        id: 'u',
        plan: 'BUILDER',
        role: 'user',
        subscriptionStatus: status,
      })
      assert.equal(paid, false)
      delete process.env.DEV_SIMULATE_BILLING
    })
  }

  it('canSharePublicly revoked for Studio plan', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(
      canSharePublicly({ id: 'u', plan: 'TEAM', role: 'user', subscriptionStatus: 'CANCELED' }),
      false
    )
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('purchased credits remain spendable after revocation', async () => {
    // Purchased credit packs are a distinct, already-paid-for transaction
    // and remain available regardless of subscription state (same as FREE plan).
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.creditPurchase.aggregate).mockResolvedValueOnce({
      _sum: { creditsRemaining: 3 },
    } as never)
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'revoked-with-credits',
      plan: 'BUILDER',
      role: 'user',
      auditsUsed: 0,
      auditsLimit: 25,
      subscriptionStatus: 'CANCELED',
    })
    assert.equal(await resolveIncludeAiForNewAudit('revoked-with-credits'), true)
  })

  it('revoked user with zero credits gets no AI', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.creditPurchase.aggregate).mockResolvedValueOnce({
      _sum: { creditsRemaining: 0 },
    } as never)
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'revoked-no-credits',
      plan: 'BUILDER',
      role: 'user',
      auditsUsed: 0,
      auditsLimit: 25,
      subscriptionStatus: 'CANCELED',
    })
    assert.equal(await resolveIncludeAiForNewAudit('revoked-no-credits'), false)
  })
})
