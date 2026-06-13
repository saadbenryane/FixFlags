import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canAccessPaidFeatures,
  getEntitlements,
  getReportTierForUser,
  hasUsedFreeRecheck,
} from '@/lib/auth/entitlements'
import { gateAuditResponse } from '@/lib/audit/access'
import { validateAndRepairJudgeOutput } from '@/lib/audit/validate-judge-output'
import { resolveFreeUserUpgradeMoment } from '@/lib/billing/upgrade-moments'

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

describe('resolveFreeUserUpgradeMoment', () => {
  it('prefers hidden findings over trial recheck', () => {
    assert.equal(
      resolveFreeUserUpgradeMoment({ hiddenCount: 2, canUseFreeRecheck: true }),
      'hidden_findings'
    )
  })

  it('shows trial recheck when no hidden findings remain', () => {
    assert.equal(
      resolveFreeUserUpgradeMoment({ hiddenCount: 0, canUseFreeRecheck: true }),
      'trial_recheck_available'
    )
  })
})

describe('gateAuditResponse', () => {
  it('limits free tier to three findings per area', () => {
    const findings = Array.from({ length: 5 }, (_, i) => ({
      id: `f${i}`,
      severity: 'HIGH',
      problem: `Issue ${i}`,
      evidence: 'evidence',
      whyItMatters: 'matters',
      fix: 'fix',
      agentPrompt: 'prompt',
      cursorPrompt: 'cursor',
      claudePrompt: null,
      lovablePrompt: null,
      boltPrompt: null,
      verificationRule: 'rule',
    }))

    const gated = gateAuditResponse(
      {
        areas: [
          {
            id: 'a1',
            name: 'SEO',
            grade: 'C',
            score: 70,
            status: 'WARN',
            summary: 'Issues',
            areaPrompt: 'Fix seo',
            cursorPrompt: 'cursor',
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
            findings,
          },
        ],
      },
      false
    )

    assert.equal(gated.areas[0].findings.length, 3)
    assert.equal(gated.areas[0].findings[0].agentPrompt, null)
  })
})

describe('validateAndRepairJudgeOutput', () => {
  it('adds missing areas up to seven', () => {
    const output = validateAndRepairJudgeOutput(
      {
        pageJob: 'Sell',
        pageType: 'marketing',
        verdict: 'ok',
        score: 80,
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

  it('downgrades grade B with zero findings to A', () => {
    const output = validateAndRepairJudgeOutput(
      {
        pageJob: 'Sell',
        pageType: 'marketing',
        verdict: 'ok',
        score: 80,
        areas: [
          {
            name: 'SEO',
            grade: 'B',
            status: 'WARN',
            summary: 'Issues',
            areaPrompt: 'Fix seo',
          },
        ],
        newFindings: [],
        enrichments: [],
      },
      []
    )
    const seo = output.areas.find((a) => a.name === 'SEO')
    assert.equal(seo?.grade, 'A')
  })

  it('synthesizes enrichments for deterministic findings', () => {
    const output = validateAndRepairJudgeOutput(
      {
        pageJob: 'Sell',
        pageType: 'marketing',
        verdict: 'ok',
        score: 70,
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
})
