import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auditFindUnique: vi.fn(),
  flagFindMany: vi.fn(),
  improvementFindFirst: vi.fn(),
  improvementUpsert: vi.fn(),
  improvementUpdate: vi.fn(),
  occurrenceUpsert: vi.fn(),
  occurrenceFindMany: vi.fn(),
  attemptCreate: vi.fn(),
  attemptFindFirst: vi.fn(),
  attemptUpdate: vi.fn(),
  projectFindFirst: vi.fn(),
  transaction: vi.fn(),
  buildUnifiedPlanBundle: vi.fn(),
  mutateProjectIntelligence: vi.fn(),
  appendVerifiedLearning: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    audit: { findUnique: mocks.auditFindUnique },
    flag: { findMany: mocks.flagFindMany },
    improvement: {
      findFirst: mocks.improvementFindFirst,
      upsert: mocks.improvementUpsert,
      update: mocks.improvementUpdate,
    },
    improvementOccurrence: {
      upsert: mocks.occurrenceUpsert,
      findMany: mocks.occurrenceFindMany,
    },
    improvementAttempt: {
      create: mocks.attemptCreate,
      update: mocks.attemptUpdate,
    },
    project: { findFirst: mocks.projectFindFirst },
    $transaction: mocks.transaction,
  },
}))

vi.mock('@/lib/audit/load-finish-plan-flags', () => ({
  buildUnifiedPlanBundle: mocks.buildUnifiedPlanBundle,
}))

vi.mock('@/lib/audit/ensure-product-project', () => ({
  mutateProjectIntelligence: mocks.mutateProjectIntelligence,
}))

vi.mock('@/lib/audit/product-intelligence', () => ({
  productIntelligenceFromContract: vi.fn(() => ({
    purpose: 'Purpose',
    firstValueJourney: 'Journey',
    criticalOutcomes: [],
    source: 'heuristic',
    updatedAt: '2026-08-13T00:00:00.000Z',
  })),
  appendVerifiedLearning: mocks.appendVerifiedLearning,
}))

import {
  createImprovementAttempt,
  improvementFingerprint,
  materializeAttentionForAudit,
  reconcileImprovementVerification,
} from './service'

const flag = {
  id: 'flag-1',
  checkId: 'cta-dead-link::page:2',
  rubric: 'EXPERIENCE',
  severity: 'IMPORTANT',
  impactTag: 'CONVERSION',
  problem: 'The primary action is broken',
  evidence: 'Clicking it does nothing',
  whyItMatters: 'People cannot complete signup',
  fix: 'Restore the action',
  agentPrompt: null,
  cursorPrompt: null,
  claudePrompt: null,
  windsurfPrompt: null,
  lovablePrompt: null,
  boltPrompt: null,
  verificationRule: 'Clicking the action reaches signup',
  pageUrl: 'https://example.com',
  confidence: 1,
  source: 'DETERMINISTIC',
  status: 'OPEN',
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.transaction.mockImplementation(async (input: unknown) => {
    if (typeof input === 'function') {
      return input({
        improvementAttempt: {
          create: mocks.attemptCreate,
          findFirst: mocks.attemptFindFirst,
          update: mocks.attemptUpdate,
        },
        improvement: { update: mocks.improvementUpdate },
      })
    }
    return Promise.all(input as Promise<unknown>[])
  })
  mocks.improvementUpdate.mockResolvedValue({})
  mocks.attemptUpdate.mockResolvedValue({})
  mocks.attemptFindFirst.mockResolvedValue(null)
  mocks.occurrenceUpsert.mockResolvedValue({})
  mocks.appendVerifiedLearning.mockImplementation((memory, learning) => ({
    ...memory,
    verifiedLearnings: [learning],
  }))
  mocks.mutateProjectIntelligence.mockImplementation(async (_projectId, mutation) =>
    mutation(null)
  )
})

describe('improvementFingerprint', () => {
  it('matches deterministic page variants to one durable Improvement', () => {
    expect(improvementFingerprint(flag)).toBe('check:cta-dead-link')
  })

  it('collapses equivalent journey observations into one Product Improvement', () => {
    expect(improvementFingerprint({
      ...flag,
      checkId: 'journey-signup-hidden-cta',
      problem: 'No obvious primary CTA on first visit',
    })).toBe('check:journey-hidden-cta')
    expect(improvementFingerprint({
      ...flag,
      checkId: 'journey-pricing-evaluation-hidden-cta',
      problem: 'No obvious primary CTA on first visit',
    })).toBe('check:journey-hidden-cta')
  })
})

describe('materializeAttentionForAudit', () => {
  it('does nothing for an anonymous Review', async () => {
    mocks.auditFindUnique.mockResolvedValue({ userId: null, projectId: 'product-1' })
    await materializeAttentionForAudit('review-1')
    expect(mocks.buildUnifiedPlanBundle).not.toHaveBeenCalled()
    expect(mocks.improvementUpsert).not.toHaveBeenCalled()
  })

  it('creates durable attention from worthwhile bounded Finish Plan items', async () => {
    mocks.auditFindUnique.mockResolvedValue({
      id: 'review-1',
      userId: 'user-1',
      projectId: 'product-1',
      url: 'https://example.com',
      productContract: {
        purpose: 'Help people register',
        firstValueJourney: 'Open signup',
        criticalOutcomes: ['Signup completes'],
        inferredAt: '2026-08-13T00:00:00.000Z',
        source: 'user',
      },
      flags: [flag],
      rubrics: [],
    })
    mocks.buildUnifiedPlanBundle.mockResolvedValue({
      finishPlan: {
        items: [
          {
            id: flag.id,
            severity: flag.severity,
            problem: flag.problem,
            whyItMatters: flag.whyItMatters,
            recommendedChange: flag.fix,
            protectedScope: 'Keep existing account access',
            verificationRule: flag.verificationRule,
          },
        ],
      },
    })
    mocks.improvementUpsert.mockResolvedValue({ id: 'improvement-1' })

    await materializeAttentionForAudit('review-1')

    expect(mocks.improvementUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId_fingerprint: {
            projectId: 'product-1',
            fingerprint: 'check:cta-dead-link',
          },
        },
      })
    )
    expect(mocks.occurrenceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          improvementId: 'improvement-1',
          auditId: 'review-1',
          flagId: 'flag-1',
        }),
      })
    )
  })
})

describe('createImprovementAttempt', () => {
  it('enforces Product ownership and advances a declared change to verification', async () => {
    mocks.improvementFindFirst.mockResolvedValue({ id: 'improvement-1' })
    mocks.attemptCreate.mockResolvedValue({ id: 'attempt-1' })

    await createImprovementAttempt({
      improvementId: 'improvement-1',
      projectId: 'product-1',
      userId: 'user-1',
      sourceAuditId: 'review-1',
      builder: 'Codex',
      changeSummary: 'Restored the signup action',
    })

    expect(mocks.improvementFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ project: { userId: 'user-1' } }),
      })
    )
    expect(mocks.improvementUpdate).toHaveBeenCalledWith({
      where: { id: 'improvement-1' },
      data: { status: 'READY_TO_VERIFY' },
    })
  })

  it('updates the one open attempt for the same Improvement and source Review', async () => {
    mocks.improvementFindFirst.mockResolvedValue({ id: 'improvement-1' })
    mocks.attemptFindFirst.mockResolvedValue({ id: 'attempt-1' })
    mocks.attemptUpdate.mockResolvedValue({ id: 'attempt-1' })

    const attempt = await createImprovementAttempt({
      improvementId: 'improvement-1',
      projectId: 'product-1',
      userId: 'user-1',
      sourceAuditId: 'review-1',
      builder: 'Codex',
      changeSummary: 'Restored the signup action',
      deploymentReference: 'deploy-2',
    })

    expect(attempt).toEqual({ id: 'attempt-1' })
    expect(mocks.attemptCreate).not.toHaveBeenCalled()
    expect(mocks.attemptUpdate).toHaveBeenCalledWith({
      where: { id: 'attempt-1' },
      data: expect.objectContaining({
        changeSummary: 'Restored the signup action',
        deploymentReference: 'deploy-2',
      }),
    })
  })
})

describe('reconcileImprovementVerification', () => {
  it('verifies only through a fresh child Review and writes provenance to Product Memory', async () => {
    mocks.auditFindUnique.mockResolvedValue({
      id: 'review-2',
      parentId: 'review-1',
      projectId: 'product-1',
      productContract: {
        purpose: 'Help people register',
        firstValueJourney: 'Open signup',
        criticalOutcomes: ['Signup completes'],
        inferredAt: '2026-08-13T00:00:00.000Z',
        source: 'user',
      },
      status: 'COMPLETED',
      reportCompleteness: 'FULL',
      evidenceCoverage: {
        desktopScreenshot: true,
        metadata: true,
        aiAssessment: true,
      },
      failedModules: [],
      journeyReviewIncluded: false,
      journeyReviewAt: null,
      pages: [{ url: 'https://example.com', status: 'COMPLETED' }],
    })
    mocks.flagFindMany.mockResolvedValue([])
    mocks.occurrenceFindMany.mockResolvedValue([
      {
        improvementId: 'improvement-1',
        flagId: 'flag-1',
        flag,
        improvement: {
          successCondition: flag.verificationRule,
          attempts: [{ id: 'attempt-1' }],
        },
      },
    ])

    const results = await reconcileImprovementVerification({
      parentAuditId: 'review-1',
      verificationAuditId: 'review-2',
    })

    expect(results).toEqual([
      expect.objectContaining({ outcome: 'IMPROVED', status: 'VERIFIED' }),
    ])
    expect(mocks.attemptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          verificationAuditId: 'review-2',
          outcome: 'IMPROVED',
          testedCondition: flag.verificationRule,
        }),
      })
    )
    expect(mocks.mutateProjectIntelligence).toHaveBeenCalledWith(
      'product-1',
      expect.any(Function)
    )
    expect(mocks.appendVerifiedLearning).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        improvementId: 'improvement-1',
        attemptId: 'attempt-1',
        auditId: 'review-2',
      })
    )
  })

  it('records INCONCLUSIVE and does not learn when verifier evidence is incomplete', async () => {
    mocks.auditFindUnique.mockResolvedValue({
      id: 'review-2',
      parentId: 'review-1',
      projectId: 'product-1',
      productContract: null,
      status: 'COMPLETED',
      reportCompleteness: 'PARTIAL',
      evidenceCoverage: { desktopScreenshot: true, metadata: true, aiAssessment: false },
      failedModules: ['interaction'],
      journeyReviewIncluded: false,
      journeyReviewAt: null,
      pages: [{ url: 'https://example.com', status: 'PARTIAL' }],
    })
    mocks.flagFindMany.mockResolvedValue([])
    mocks.occurrenceFindMany.mockResolvedValue([{
      improvementId: 'improvement-1',
      flagId: 'flag-1',
      flag,
      improvement: {
        successCondition: flag.verificationRule,
        attempts: [{ id: 'attempt-1' }],
      },
    }])

    const results = await reconcileImprovementVerification({
      parentAuditId: 'review-1',
      verificationAuditId: 'review-2',
    })

    expect(results).toEqual([
      expect.objectContaining({
        outcome: 'INCONCLUSIVE',
        status: 'UNVERIFIED',
        comparable: false,
      }),
    ])
    expect(mocks.attemptUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        outcome: 'INCONCLUSIVE',
        comparable: false,
        verificationReason: expect.stringMatching(/partial/i),
      }),
    }))
    expect(mocks.appendVerifiedLearning).not.toHaveBeenCalled()
  })
})
