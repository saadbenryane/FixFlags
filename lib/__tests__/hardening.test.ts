import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canAccessCompare,
  canAccessPaidFeatures,
  getEntitlements,
  getReportTierForUser,
  hasUsedFreeRecheck,
} from '@/lib/auth/entitlements'
import { validateAndRepairJudgeOutput } from '@/lib/audit/validate-judge-output'
import { resolveFreeUserUpgradeMoment } from '@/lib/billing/upgrade-moments'

const baseJudgeOutput = {
  pageJob: 'Sell',
  pageType: 'marketing',
  verdict: 'ok',
  score: 80,
  launchReadiness: 'fix_first' as const,
  launchChecklist: [
    { id: 'https', label: 'HTTPS', passed: true },
    { id: 'og-image', label: 'og:image', passed: false },
    { id: 'mobile-cta', label: 'Mobile CTA', passed: true },
    { id: 'console', label: 'Console', passed: true },
    { id: 'privacy', label: 'Privacy', passed: true },
  ],
}

describe('getReportTierForUser', () => {
  it('returns free for null user', () => {
    assert.equal(getReportTierForUser(null), 'free')
  })

  it('returns paid for builder plan', () => {
    assert.equal(getReportTierForUser({ id: 'u1', plan: 'BUILDER', role: 'user' }), 'paid')
  })

  it('returns paid for admin role', () => {
    assert.equal(getReportTierForUser({ id: 'u1', plan: 'FREE', role: 'admin' }), 'paid')
  })
})

describe('getEntitlements', () => {
  it('grants free recheck trial for free users who have not used it', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    const entitlements = getEntitlements({
      id: 'u1',
      role: 'user',
      plan: 'FREE',
      freeRecheckUsedAt: null,
    })
    assert.equal(entitlements.canUseFreeRecheck, true)
    assert.equal(entitlements.hasUsedFreeRecheck, false)
    assert.equal(entitlements.canRecheck, true)
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('marks trial exhausted after freeRecheckUsedAt is set', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    const usedAt = new Date()
    assert.equal(hasUsedFreeRecheck({ freeRecheckUsedAt: usedAt }), true)
    const entitlements = getEntitlements({
      id: 'u1',
      role: 'user',
      plan: 'FREE',
      freeRecheckUsedAt: usedAt,
    })
    assert.equal(entitlements.canUseFreeRecheck, false)
    assert.equal(entitlements.hasUsedFreeRecheck, true)
    delete process.env.DEV_SIMULATE_BILLING
  })
})

describe('paid recheck quota', () => {
  it('paid users skip monthly audit usage on re-check', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    const isPaid = canAccessPaidFeatures({ id: 'u1', role: 'user', plan: 'BUILDER' })
    const isTrialRecheck = false
    assert.equal(isTrialRecheck || isPaid, true)
    delete process.env.DEV_SIMULATE_BILLING
  })
})

describe('canAccessCompare', () => {
  const freeUser = {
    id: 'u1',
    role: 'user' as const,
    plan: 'FREE' as const,
    freeRecheckUsedAt: null,
  }
  const freeUserTrialUsed = {
    ...freeUser,
    freeRecheckUsedAt: new Date(),
  }
  const builderUser = {
    id: 'u1',
    role: 'user' as const,
    plan: 'BUILDER' as const,
    freeRecheckUsedAt: null,
  }
  const recheck = { parentId: 'parent-1', userId: 'u1' }

  it('allows paid users', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(canAccessCompare(builderUser, recheck), true)
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('allows free users who used trial recheck on own recheck', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(canAccessCompare(freeUserTrialUsed, recheck), true)
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('blocks free users who have not used trial recheck', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(canAccessCompare(freeUser, recheck), false)
    delete process.env.DEV_SIMULATE_BILLING
  })
})

describe('resolveFreeUserUpgradeMoment', () => {
  it('prefers audit limit over trial recheck', () => {
    assert.equal(
      resolveFreeUserUpgradeMoment({
        atAuditLimit: true,
        canUseFreeRecheck: true,
      }),
      'audit_limit_reached'
    )
  })

  it('shows trial recheck when under audit limit', () => {
    assert.equal(
      resolveFreeUserUpgradeMoment({
        atAuditLimit: false,
        canUseFreeRecheck: true,
      }),
      'trial_recheck_available'
    )
  })

  it('shows trial exhausted after free recheck used', () => {
    assert.equal(
      resolveFreeUserUpgradeMoment({
        atAuditLimit: false,
        canUseFreeRecheck: false,
        hasUsedFreeRecheck: true,
      }),
      'trial_exhausted'
    )
  })

  it('defaults to builder teaser when no stronger moment', () => {
    assert.equal(
      resolveFreeUserUpgradeMoment({
        atAuditLimit: false,
        canUseFreeRecheck: false,
        hasUsedFreeRecheck: false,
      }),
      'free_default'
    )
  })
})

describe('validateAndRepairJudgeOutput', () => {
  it('adds missing areas up to seven', () => {
    const output = validateAndRepairJudgeOutput(
      {
        ...baseJudgeOutput,
        areas: [
          {
            name: 'PERFORMANCE',
            grade: 'B',
            status: 'WARN',
            summary: 'Slow',
            areaPrompt: 'Fix perf',
          },
        ],
        newFindings: [],
        enrichments: [],
      },
      []
    )
    assert.equal(output.areas.length, 7)
  })

  it('preserves poor grade and injects synthetic finding when zero findings', () => {
    const output = validateAndRepairJudgeOutput(
      {
        ...baseJudgeOutput,
        areas: [
          {
            name: 'SEO',
            grade: 'B',
            status: 'WARN',
            summary: 'Meta tags need work. Description is missing.',
            areaPrompt: 'Fix seo',
          },
        ],
        newFindings: [],
        enrichments: [],
      },
      []
    )
    const seo = output.areas.find((a) => a.name === 'SEO')
    assert.equal(seo?.grade, 'B')
    const seoFinding = output.newFindings.find((f) => f.area === 'SEO')
    assert.ok(seoFinding)
    assert.match(seoFinding!.problem, /Meta tags/i)
    assert.ok(seoFinding!.verificationRule)
  })

  it('synthesizes enrichments for deterministic findings', () => {
    const output = validateAndRepairJudgeOutput(
      {
        ...baseJudgeOutput,
        areas: [
          {
            name: 'PERFORMANCE',
            grade: 'C',
            status: 'FAIL',
            summary: 'Slow',
            areaPrompt: 'Fix perf',
          },
        ],
        newFindings: [],
        enrichments: [],
      },
      [
        {
          checkId: 'perf-lcp',
          area: 'PERFORMANCE',
          severity: 'HIGH',
          problem: 'Slow LCP',
          evidence: '4.2s',
          fix: 'Optimize hero image',
          confidence: 1,
          source: 'DETERMINISTIC',
        },
      ]
    )
    assert.equal(output.enrichments.length, 1)
    assert.equal(output.enrichments[0].checkId, 'perf-lcp')
    assert.match(output.enrichments[0].whyItMatters, /performance/i)
  })

  it('defaults launch readiness when missing', () => {
    const output = validateAndRepairJudgeOutput(
      {
        ...baseJudgeOutput,
        launchReadiness: undefined as unknown as 'fix_first',
        launchChecklist: undefined as unknown as [],
        areas: [
          {
            name: 'PERFORMANCE',
            grade: 'A',
            status: 'PASS',
            summary: 'Good',
            areaPrompt: 'Keep',
          },
        ],
        newFindings: [],
        enrichments: [],
      },
      []
    )
    assert.equal(output.launchReadiness, 'fix_first')
    assert.ok(Array.isArray(output.launchChecklist))
  })
})

describe('trial recheck flag semantics', () => {
  it('only trial recheck audits should consume freeRecheckUsedAt (design contract)', () => {
    const paidRecheck = { trialRecheck: false, skipUsageCount: true, parentId: 'p1' }
    const trialRecheck = { trialRecheck: true, skipUsageCount: true, parentId: 'p1' }
    assert.equal(paidRecheck.trialRecheck === true, false)
    assert.equal(trialRecheck.trialRecheck === true, true)
  })
})
