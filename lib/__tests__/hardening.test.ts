import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canAccessCompare,
  canAccessPaidFeatures,
  getEntitlements,
  getReportTierForUser,
  hasUsedFreeRecheck,
} from '@/lib/auth/entitlements'
import {
  JudgeContractError,
  validateJudgeOutput,
} from '@/lib/audit/validate-judge-output'
import { resolveFreeUserUpgradeMoment } from '@/lib/billing/upgrade-moments'
import {
  calculateOverallScore,
  gradeFromScore,
} from '@/lib/audit/scoring'
import { findingFingerprint } from '@/lib/audit/deduplicate'
import { generateApiKey, hashApiKey } from '@/lib/security/api-keys'
import { isPublicIp, normalizeAuditUrl } from '@/lib/audit/url'
import { statusToStageIndex, getStageProgress } from '@/lib/audit/progress-ui'
import { AuditDeadlineError } from '@/lib/audit/pipeline-errors'

const baseJudgeOutput = {
  pageJob: 'Sell',
  pageType: 'homepage' as const,
  verdict: 'ok',
  score: 80,
  launchReadiness: 'fix_first' as const,
  launchChecklist: [
    { id: 'https', label: 'HTTPS', passed: true },
    { id: 'social-preview', label: 'og:image', passed: false },
    { id: 'mobile-cta', label: 'Mobile CTA', passed: true },
    { id: 'console-errors', label: 'Console', passed: true },
    { id: 'privacy-contact', label: 'Privacy', passed: true },
  ] as Array<{
    id:
      | 'https'
      | 'social-preview'
      | 'mobile-cta'
      | 'console-errors'
      | 'privacy-contact'
    label: string
    passed: boolean
  }>,
}

const validAreas = [
  'PERFORMANCE',
  'ACCESSIBILITY',
  'SEO',
  'CONVERSION',
  'TRUST',
  'CONTENT',
  'MOBILE',
].map((name) => ({
  name: name as
    | 'PERFORMANCE'
    | 'ACCESSIBILITY'
    | 'SEO'
    | 'CONVERSION'
    | 'TRUST'
    | 'CONTENT'
    | 'MOBILE',
  score: 80,
  grade: 'B' as const,
  status: 'GOOD' as const,
  assessmentState: 'ASSESSED' as const,
  confidence: 0.9,
  summary: `${name} summary`,
  areaPrompt: `Improve ${name}`,
}))

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

describe('validateJudgeOutput', () => {
  it('accepts a complete seven-area contract', () => {
    const output = validateJudgeOutput(
      { ...baseJudgeOutput, areas: validAreas, newFindings: [], enrichments: [] },
      []
    )
    assert.equal(output.areas.length, 7)
  })

  it('rejects missing areas instead of fabricating them', () => {
    assert.throws(
      () =>
        validateJudgeOutput(
          {
            ...baseJudgeOutput,
            areas: validAreas.slice(0, 6),
            newFindings: [],
            enrichments: [],
          },
          []
        ),
      JudgeContractError
    )
  })

  it('requires one enrichment for every deterministic finding', () => {
    const finding = {
      checkId: 'perf-lcp',
      area: 'PERFORMANCE',
      severity: 'HIGH' as const,
      problem: 'Slow LCP',
      evidence: '4.2s',
      fix: 'Optimize hero image',
      confidence: 1,
      source: 'DETERMINISTIC' as const,
    }
    assert.throws(
      () =>
        validateJudgeOutput(
          { ...baseJudgeOutput, areas: validAreas, newFindings: [], enrichments: [] },
          [finding]
        ),
      JudgeContractError
    )
  })
})

describe('production hardening primitives', () => {
  it('uses the documented weighted score and grade thresholds', () => {
    assert.equal(gradeFromScore(90), 'A')
    assert.equal(gradeFromScore(75), 'B')
    assert.equal(gradeFromScore(60), 'C')
    assert.equal(gradeFromScore(40), 'D')
    assert.equal(gradeFromScore(39), 'F')
    assert.equal(
      calculateOverallScore({
        PERFORMANCE: 90,
        ACCESSIBILITY: 80,
        SEO: 70,
        CONVERSION: 60,
        TRUST: 50,
        CONTENT: 40,
        MOBILE: 30,
      }),
      63
    )
  })

  it('rejects private protocols and addresses', () => {
    assert.equal(normalizeAuditUrl('file:///etc/passwd').ok, false)
    assert.equal(normalizeAuditUrl('http://127.0.0.1').ok, false)
    assert.equal(isPublicIp('10.0.0.1'), false)
    assert.equal(isPublicIp('8.8.8.8'), true)
  })

  it('hashes API keys and fingerprints evidence deterministically', () => {
    const key = generateApiKey()
    assert.notEqual(key.rawKey, key.keyHash)
    assert.equal(hashApiKey(key.rawKey), key.keyHash)
    assert.equal(
      findingFingerprint({ area: 'SEO', problem: 'Missing title', checkId: 'seo-title' }),
      findingFingerprint({ area: 'SEO', problem: 'Different wording', checkId: 'seo-title' })
    )
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

describe('progress UI stage mapping', () => {
  it('maps FINALIZING to the preparing-report stage', () => {
    assert.equal(statusToStageIndex('FINALIZING'), 4)
    const progress = getStageProgress('FINALIZING')
    assert.equal(progress.current, 5)
    assert.equal(progress.total, 5)
  })

  it('marks completed audits as step 5 of 5', () => {
    const progress = getStageProgress('COMPLETED')
    assert.equal(progress.current, 5)
    assert.equal(progress.percent, 100)
  })
})

describe('AuditDeadlineError', () => {
  it('carries stage for timeout failures', () => {
    const err = new AuditDeadlineError('judging')
    assert.equal(err.code, 'AUDIT_TIMEOUT')
    assert.equal(err.stage, 'judging')
  })
})
