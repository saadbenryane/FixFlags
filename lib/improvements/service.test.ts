import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auditFindUnique: vi.fn(),
  flagFindMany: vi.fn(),
  flagFindFirst: vi.fn(),
  flagUpdate: vi.fn(),
  auditUpdate: vi.fn(),
  improvementFindFirst: vi.fn(),
  improvementFindMany: vi.fn(),
  improvementUpsert: vi.fn(),
  improvementUpdate: vi.fn(),
  improvementUpdateMany: vi.fn(),
  occurrenceUpsert: vi.fn(),
  occurrenceFindMany: vi.fn(),
  attemptCreate: vi.fn(),
  attemptFindFirst: vi.fn(),
  attemptUpdate: vi.fn(),
  cycleUpsert: vi.fn(),
  cycleEventUpsert: vi.fn(),
  projectFindFirst: vi.fn(),
  transaction: vi.fn(),
  executeRaw: vi.fn(),
  buildUnifiedPlanBundle: vi.fn(),
  mutateProjectIntelligence: vi.fn(),
  appendVerifiedLearning: vi.fn(),
  ensureProductProject: vi.fn(),
  appendIntentionalNote: vi.fn(),
  appendKnownRisk: vi.fn(),
  mergeContractIntoProductIntelligence: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    audit: { findUnique: mocks.auditFindUnique, update: mocks.auditUpdate },
    flag: {
      findMany: mocks.flagFindMany,
      findFirst: mocks.flagFindFirst,
      update: mocks.flagUpdate,
    },
    improvement: {
      findFirst: mocks.improvementFindFirst,
      findMany: mocks.improvementFindMany,
      upsert: mocks.improvementUpsert,
      update: mocks.improvementUpdate,
      updateMany: mocks.improvementUpdateMany,
    },
    improvementOccurrence: {
      upsert: mocks.occurrenceUpsert,
      findMany: mocks.occurrenceFindMany,
    },
    improvementAttempt: {
      create: mocks.attemptCreate,
      update: mocks.attemptUpdate,
    },
    improvementCycle: { upsert: mocks.cycleUpsert },
    improvementCycleEvent: { upsert: mocks.cycleEventUpsert },
    project: { findFirst: mocks.projectFindFirst },
    $transaction: mocks.transaction,
  },
}))

vi.mock('@/lib/audit/load-finish-plan-flags', () => ({
  buildUnifiedPlanBundle: mocks.buildUnifiedPlanBundle,
}))

vi.mock('@/lib/audit/ensure-product-project', () => ({
  ensureProductProject: mocks.ensureProductProject,
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
  appendIntentionalNote: mocks.appendIntentionalNote,
  appendKnownRisk: mocks.appendKnownRisk,
  mergeContractIntoProductIntelligence: mocks.mergeContractIntoProductIntelligence,
}))

import {
  createImprovementAttempt,
  improvementFingerprint,
  materializeAttentionForAudit,
  recordFlagImprovementAttempt,
  recordOwnerFlagFeedbackDecision,
  recordRecommendedImprovements,
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
        improvement: {
          update: mocks.improvementUpdate,
          updateMany: mocks.improvementUpdateMany,
        },
        improvementOccurrence: { upsert: mocks.occurrenceUpsert },
        improvementCycle: { upsert: mocks.cycleUpsert },
        improvementCycleEvent: { upsert: mocks.cycleEventUpsert },
        $executeRaw: mocks.executeRaw,
      })
    }
    return Promise.all(input as Promise<unknown>[])
  })
  mocks.improvementUpdate.mockResolvedValue({})
  mocks.executeRaw.mockResolvedValue(1)
  mocks.improvementUpdateMany.mockResolvedValue({ count: 1 })
  mocks.attemptUpdate.mockResolvedValue({})
  mocks.attemptFindFirst.mockResolvedValue(null)
  mocks.occurrenceUpsert.mockResolvedValue({ id: 'occurrence-1' })
  mocks.cycleUpsert.mockResolvedValue({ id: 'cycle-1' })
  mocks.cycleEventUpsert.mockResolvedValue({ id: 'event-1' })
  mocks.appendVerifiedLearning.mockImplementation((memory, learning) => ({
    ...memory,
    verifiedLearnings: [learning],
  }))
  mocks.mutateProjectIntelligence.mockImplementation(async (_projectId, mutation) =>
    mutation(null)
  )
  mocks.flagUpdate.mockResolvedValue({})
  mocks.auditUpdate.mockResolvedValue({})
  mocks.ensureProductProject.mockResolvedValue({ id: 'product-1' })
  mocks.appendIntentionalNote.mockImplementation((memory) => memory)
  mocks.appendKnownRisk.mockImplementation((memory) => memory)
  mocks.mergeContractIntoProductIntelligence.mockImplementation((memory) => memory)
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
    expect(mocks.improvementUpdateMany).toHaveBeenCalledWith({
      where: { id: 'improvement-1', acceptedAt: null },
      data: { acceptedAt: expect.any(Date), acceptedByChannel: 'Codex' },
    })
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1)
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

describe('recordFlagImprovementAttempt', () => {
  const ownedFlag = {
    ...flag,
    improvementOccurrence: { id: 'occurrence-1', improvementId: 'improvement-1' },
    audit: {
      id: 'review-1',
      projectId: 'product-1',
      productContract: null,
    },
  }

  it('records explicit acceptance without creating an Improvement Attempt', async () => {
    mocks.flagFindFirst.mockResolvedValue(ownedFlag)

    const result = await recordFlagImprovementAttempt({
      flagId: 'flag-1',
      userId: 'user-1',
      builder: 'web',
      action: 'ACCEPT',
    })

    expect(result).toMatchObject({
      action: 'ACCEPT',
      improvementId: 'improvement-1',
      attemptId: null,
      nextAction: { type: 'IMPLEMENT' },
    })
    expect(mocks.attemptCreate).not.toHaveBeenCalled()
    expect(mocks.improvementUpdateMany).toHaveBeenCalledWith({
      where: { id: 'improvement-1', acceptedAt: null },
      data: { acceptedAt: expect.any(Date), acceptedByChannel: 'web' },
    })
  })

  it('records prompt handoff without accepting or creating an attempt', async () => {
    mocks.flagFindFirst.mockResolvedValue(ownedFlag)

    const result = await recordFlagImprovementAttempt({
      flagId: 'flag-1',
      userId: 'user-1',
      builder: 'web',
      action: 'HANDOFF_COPIED',
    })

    expect(result).toMatchObject({ action: 'HANDOFF_COPIED', attemptId: null })
    expect(mocks.improvementUpdateMany).not.toHaveBeenCalled()
    expect(mocks.attemptCreate).not.toHaveBeenCalled()
    expect(mocks.cycleEventUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        type: 'HANDOFF_COPIED',
        idempotencyKey: 'handoff-copied:flag-1',
      }),
    }))
  })

  it('requires and persists a structured rejection reason', async () => {
    mocks.flagFindFirst.mockResolvedValue(ownedFlag)

    await expect(recordFlagImprovementAttempt({
      flagId: 'flag-1',
      userId: 'user-1',
      builder: 'MCP',
      action: 'REJECT',
    })).rejects.toThrow(/why this recommendation/i)

    const result = await recordFlagImprovementAttempt({
      flagId: 'flag-1',
      userId: 'user-1',
      builder: 'MCP',
      action: 'REJECT',
      rejectionReason: 'TOO_COSTLY',
      rejectionNote: 'Needs a larger migration',
    })

    expect(result).toMatchObject({ action: 'REJECT', rejectionReason: 'TOO_COSTLY' })
    expect(mocks.improvementUpdate).toHaveBeenCalledWith({
      where: { id: 'improvement-1' },
      data: {
        status: 'REJECTED',
        rejectionReason: 'TOO_COSTLY',
        rejectionNote: 'Needs a larger migration',
        rejectedAt: expect.any(Date),
      },
    })
    expect(mocks.cycleEventUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        type: 'REJECTED',
        rejectionReason: 'TOO_COSTLY',
        rejectionNote: 'Needs a larger migration',
      }),
    }))
  })
})

describe('recordOwnerFlagFeedbackDecision', () => {
  const ownerDecisionFlag = {
    id: 'flag-1',
    problem: flag.problem,
    audit: {
      id: 'review-1',
      url: 'https://example.com',
      projectId: 'product-1',
      productContract: null,
    },
  }
  const ownedAttemptFlag = {
    ...flag,
    improvementOccurrence: { id: 'occurrence-1', improvementId: 'improvement-1' },
    audit: {
      id: 'review-1',
      projectId: 'product-1',
      productContract: null,
    },
  }

  it('turns already-fixed owner feedback into one real ready-to-verify attempt', async () => {
    mocks.flagFindFirst
      .mockResolvedValueOnce(ownerDecisionFlag)
      .mockResolvedValueOnce(ownedAttemptFlag)
    mocks.improvementFindFirst.mockResolvedValue({ id: 'improvement-1' })
    mocks.attemptCreate.mockResolvedValue({ id: 'attempt-1' })

    const result = await recordOwnerFlagFeedbackDecision({
      flagId: 'flag-1',
      userId: 'user-1',
      reason: 'already_fixed',
      note: 'Deployed the corrected action',
    })

    expect(result).toMatchObject({
      action: 'READY_TO_VERIFY',
      attemptId: 'attempt-1',
    })
    expect(mocks.attemptCreate).toHaveBeenCalledTimes(1)
    expect(mocks.cycleEventUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ type: 'ATTEMPTED' }),
    }))
    expect(mocks.flagUpdate).toHaveBeenCalledWith({
      where: { id: 'flag-1' },
      data: { status: 'IGNORED' },
    })
  })

  it('routes a duplicate dismissal through the append-only rejection ledger', async () => {
    mocks.flagFindFirst
      .mockResolvedValueOnce(ownerDecisionFlag)
      .mockResolvedValueOnce(ownedAttemptFlag)

    await recordOwnerFlagFeedbackDecision({
      flagId: 'flag-1',
      userId: 'user-1',
      reason: 'duplicate',
    })

    expect(mocks.improvementUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'SUPERSEDED' }),
    }))
    expect(mocks.cycleEventUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ type: 'REJECTED' }),
    }))
  })
})

describe('recordRecommendedImprovements', () => {
  it('records only the owned top-three recommendations idempotently', async () => {
    mocks.projectFindFirst.mockResolvedValue({ id: 'product-1' })
    mocks.improvementFindMany.mockResolvedValue([
      {
        id: 'improvement-1',
        occurrences: [{ id: 'occurrence-1', auditId: 'review-1', flagId: 'flag-1' }],
      },
    ])

    await expect(recordRecommendedImprovements({
      projectId: 'product-1',
      userId: 'user-1',
      improvementIds: ['improvement-1'],
    })).resolves.toBe(1)

    expect(mocks.cycleEventUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        type: 'RECOMMENDED',
        idempotencyKey: 'recommended:flag-1:product-workspace',
      }),
    }))
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
      verifierExecutions: [{
        targetKey: 'check:cta-dead-link',
        scopeKey: 'page:https://example.com',
        status: 'COMPLETED',
        evidenceReference: { run: 'verification-1' },
      }],
    })
    mocks.flagFindMany.mockResolvedValue([])
    mocks.occurrenceFindMany.mockResolvedValue([
      {
        improvementId: 'improvement-1',
        id: 'occurrence-1',
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
      verifierExecutions: [],
    })
    mocks.flagFindMany.mockResolvedValue([])
    mocks.occurrenceFindMany.mockResolvedValue([{
      improvementId: 'improvement-1',
      id: 'occurrence-1',
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
