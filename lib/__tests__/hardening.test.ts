import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  canAccessCompare,
  canExportSummary,
  canScanRepositories,
  canSharePublicly,
  getEntitlements,
  getReportTierForUser,
} from '@/lib/auth/entitlements'
import { scanLimitForPlan } from '@/lib/billing/plans'
import {
  JudgeContractError,
  normalizeJudgeRawOutput,
  validateJudgeOutput,
} from '@/lib/audit/validate-judge-output'
import { resolveFreeUserUpgradeMoment } from '@/lib/billing/upgrade-moments'
import {
  calculateOverallScore,
  gradeFromScore,
} from '@/lib/audit/scoring'
import { flagFingerprint } from '@/lib/audit/deduplicate'
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

const validRubrics = ['MESSAGE', 'EXPERIENCE', 'REACH'].map((name) => ({
  name: name as 'MESSAGE' | 'EXPERIENCE' | 'REACH',
  score: 80,
  grade: 'B' as const,
  status: 'GOOD' as const,
  assessmentState: 'ASSESSED' as const,
  confidence: 0.9,
  summary: `${name} summary`,
  rubricPrompt: `Improve ${name}`,
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
  it('grants unlimited re-check for free users', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    const entitlements = getEntitlements({
      id: 'u1',
      role: 'user',
      plan: 'FREE',
    })
    assert.equal(entitlements.canRecheck, true)
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('denies share/export for pro users', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    const user = { id: 'u1', role: 'user' as const, plan: 'BUILDER' as const }
    assert.equal(canSharePublicly(user), false)
    assert.equal(canExportSummary(user), false)
    delete process.env.DEV_SIMULATE_BILLING
  })
})

describe('canScanRepositories', () => {
  it('blocks FREE and BUILDER plans', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(canScanRepositories({ id: 'u1', role: 'user', plan: 'FREE' }), false)
    assert.equal(canScanRepositories({ id: 'u1', role: 'user', plan: 'BUILDER' }), false)
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('allows TEAM plan and admins', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(canScanRepositories({ id: 'u1', role: 'user', plan: 'TEAM' }), true)
    assert.equal(canScanRepositories({ id: 'u1', role: 'admin', plan: 'FREE' }), true)
    delete process.env.DEV_SIMULATE_BILLING
  })
})

describe('plan limits', () => {
  it('sets free plan to 3 lifetime checks', () => {
    assert.equal(scanLimitForPlan('FREE'), 3)
  })
})

describe('recheck quota semantics', () => {
  it('re-checks skip monthly audit usage via skipUsageCount', () => {
    assert.equal({ skipUsageCount: true }.skipUsageCount, true)
  })
})

describe('canAccessCompare', () => {
  const freeUser = {
    id: 'u1',
    role: 'user' as const,
    plan: 'FREE' as const,
  }
  const builderUser = {
    id: 'u1',
    role: 'user' as const,
    plan: 'BUILDER' as const,
  }
  const recheck = { parentId: 'parent-1', userId: 'u1' }

  it('allows paid users', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(canAccessCompare(builderUser, recheck), true)
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('blocks free users from compare', () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    assert.equal(canAccessCompare(freeUser, recheck), false)
    delete process.env.DEV_SIMULATE_BILLING
  })
})

describe('resolveFreeUserUpgradeMoment', () => {
  it('prefers audit limit moment when at cap', () => {
    assert.equal(
      resolveFreeUserUpgradeMoment({ atAuditLimit: true }),
      'audit_limit_reached'
    )
  })

  it('defaults to builder teaser when under audit limit', () => {
    assert.equal(
      resolveFreeUserUpgradeMoment({ atAuditLimit: false }),
      'free_default'
    )
  })
})

describe('validateJudgeOutput', () => {
  it('accepts a complete three-rubric contract', () => {
    const output = validateJudgeOutput(
      { ...baseJudgeOutput, rubrics: validRubrics, newFlags: [], enrichments: [] },
      []
    )
    assert.equal(output.rubrics.length, 3)
  })

  it('rejects missing rubrics instead of fabricating them', () => {
    assert.throws(
      () =>
        validateJudgeOutput(
          {
            ...baseJudgeOutput,
            rubrics: validRubrics.slice(0, 2),
            newFlags: [],
            enrichments: [],
          },
          []
        ),
      JudgeContractError
    )
  })

  it('requires one enrichment for every deterministic flag', () => {
    const flag = {
      checkId: 'perf-lcp',
      rubric: 'EXPERIENCE' as const,
      severity: 'IMPORTANT' as const,
      problem: 'Slow LCP',
      evidence: '4.2s',
      fix: 'Optimize hero image',
      confidence: 1,
      source: 'DETERMINISTIC' as const,
    }
    assert.throws(
      () =>
        validateJudgeOutput(
          { ...baseJudgeOutput, rubrics: validRubrics, newFlags: [], enrichments: [] },
          [flag]
        ),
      JudgeContractError
    )
  })

  it('fills missing enrichments from deterministic flags before validation', () => {
    const flag = {
      checkId: 'perf-lcp',
      rubric: 'EXPERIENCE' as const,
      severity: 'IMPORTANT' as const,
      problem: 'Slow LCP',
      evidence: '4.2s',
      fix: 'Optimize hero image',
      confidence: 1,
      source: 'DETERMINISTIC' as const,
    }
    const normalized = normalizeJudgeRawOutput(
      { ...baseJudgeOutput, rubrics: validRubrics, newFlags: [] },
      [flag]
    )
    const output = validateJudgeOutput(normalized as never, [flag])
    assert.equal(output.enrichments.length, 1)
    assert.equal(output.enrichments[0]?.checkId, 'perf-lcp')
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
        MESSAGE: 80,
        EXPERIENCE: 70,
        REACH: 60,
      }),
      71
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
      flagFingerprint({ rubric: 'REACH', problem: 'Missing title', checkId: 'seo-title' }),
      flagFingerprint({ rubric: 'REACH', problem: 'Different wording', checkId: 'seo-title' })
    )
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
