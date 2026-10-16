import { beforeEach, describe, expect, it, vi } from 'vitest'
import { healthyDesktopPs, pageSpeedMeasurementFixture } from '@/lib/audit/__tests__/check-fixtures'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { scopePerformanceAssertions } from '@/lib/audit/performance-measurement'

const mocks = vi.hoisted(() => ({
  auditFindUnique: vi.fn(),
  flagFindMany: vi.fn(),
  flagFindFirst: vi.fn(),
  flagUpdate: vi.fn(),
  flagUpdateMany: vi.fn(),
  auditUpdate: vi.fn(),
  improvementFindFirst: vi.fn(),
  improvementFindMany: vi.fn(),
  improvementUpsert: vi.fn(),
  improvementCreateMany: vi.fn(),
  improvementFindUniqueOrThrow: vi.fn(),
  improvementUpdate: vi.fn(),
  improvementUpdateMany: vi.fn(),
  occurrenceUpsert: vi.fn(),
  occurrenceCreateMany: vi.fn(),
  occurrenceFindUniqueOrThrow: vi.fn(),
  occurrenceFindMany: vi.fn(),
  attemptCreate: vi.fn(),
  attemptFindUnique: vi.fn(),
  attemptFindUniqueOrThrow: vi.fn(), attemptUpdateMany: vi.fn(),
  attemptFindFirst: vi.fn(),
  attemptFindMany: vi.fn(), assessmentFindFirst: vi.fn(),
  attemptUpdate: vi.fn(),
  cycleUpsert: vi.fn(),
  cycleEventUpsert: vi.fn(),
  projectFindFirst: vi.fn(),
  transaction: vi.fn(),
  executeRaw: vi.fn(),
  queryRaw: vi.fn(),
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
      updateMany: mocks.flagUpdateMany,
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
      findUnique: mocks.attemptFindUnique,
      update: mocks.attemptUpdate,
      findMany: mocks.attemptFindMany,
    },
    outcomeAssessment: { findFirst: mocks.assessmentFindFirst },
    improvementCycle: { upsert: mocks.cycleUpsert },
    improvementCycleEvent: { upsert: mocks.cycleEventUpsert },
    project: { findFirst: mocks.projectFindFirst },
    $transaction: mocks.transaction,
  },
}))

vi.mock('@/lib/audit/load-finish-plan-flags', () => ({
  buildUnifiedPlanBundle: mocks.buildUnifiedPlanBundle,
}))

vi.mock('@/lib/analytics/site-events', () => ({ recordSiteLifecycleEvent: vi.fn() }))

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
import { attemptIntentHash } from './attempt-intent'

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
        flag: { findFirst: mocks.flagFindFirst, findMany: mocks.flagFindMany, updateMany: mocks.flagUpdateMany },
        improvementAttempt: {
          create: mocks.attemptCreate,
          findUnique: mocks.attemptFindUnique,
          findUniqueOrThrow: mocks.attemptFindUniqueOrThrow,
          updateMany: mocks.attemptUpdateMany,
          findFirst: mocks.attemptFindFirst,
          update: mocks.attemptUpdate,
        },
        improvement: {
          createMany: mocks.improvementCreateMany,
          upsert: mocks.improvementUpsert,
          findUniqueOrThrow: mocks.improvementFindUniqueOrThrow,
          update: mocks.improvementUpdate,
          updateMany: mocks.improvementUpdateMany,
        },
        improvementOccurrence: { upsert: mocks.occurrenceUpsert, createMany: mocks.occurrenceCreateMany,
          findUniqueOrThrow: mocks.occurrenceFindUniqueOrThrow },
        improvementCycle: { upsert: mocks.cycleUpsert },
        improvementCycleEvent: { upsert: mocks.cycleEventUpsert },
        $executeRaw: mocks.executeRaw,
        $queryRaw: mocks.queryRaw,
      })
    }
    return Promise.all(input as Promise<unknown>[])
  })
  mocks.improvementUpdate.mockResolvedValue({})
  mocks.executeRaw.mockResolvedValue(1)
  mocks.queryRaw.mockResolvedValue([{ id: 'product-1' }])
  mocks.improvementUpdateMany.mockResolvedValue({ count: 1 })
  mocks.attemptUpdate.mockResolvedValue({})
  mocks.attemptFindFirst.mockResolvedValue(null)
  mocks.attemptFindUnique.mockResolvedValue(null)
  mocks.attemptUpdateMany.mockResolvedValue({ count: 1 }); mocks.attemptFindUniqueOrThrow.mockResolvedValue({ id: 'attempt-1' })
  mocks.attemptFindMany.mockResolvedValue([])
  mocks.improvementFindMany.mockResolvedValue([])
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
  mocks.flagUpdateMany.mockResolvedValue({ count: 1 })
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
  it('projects equivalent page observations once while retaining every source Flag and cycle event', async () => {
    const flags = [
      { ...flag, id: 'page-one', pageUrl: 'https://example.com/one' },
      { ...flag, id: 'page-two', pageUrl: 'https://example.com/two' },
      { ...flag, id: 'fixed-observation', status: 'FIXED', pageUrl: 'https://example.com/three' },
    ]
    mocks.auditFindUnique.mockResolvedValue({ id: 'review-1', userId: 'user-1', projectId: 'product-1', flags, rubrics: [] })
    mocks.improvementUpsert.mockResolvedValue({ id: 'improvement-1', status: 'VERIFIED' })
    await materializeAttentionForAudit('review-1')
    expect(mocks.improvementUpsert).toHaveBeenCalledOnce()
    expect(mocks.improvementUpdate).toHaveBeenCalledOnce()
    expect(mocks.occurrenceUpsert).toHaveBeenCalledTimes(3)
    expect(mocks.occurrenceUpsert.mock.calls.map(([input]) => input.create.flagId)).toEqual(expect.arrayContaining(flags.map(item => item.id)))
    expect(mocks.cycleEventUpsert).toHaveBeenCalledTimes(3)
    expect(mocks.cycleEventUpsert.mock.calls.map(([input]) => input.create.idempotencyKey)).toEqual(expect.arrayContaining(flags.map(item => `generated:${item.id}`)))
  })

  it.each(['VERIFIED', 'REJECTED', 'SUPERSEDED'] as const)('retains owner-engaged recommendation identity and priority without changing dismissal: %s', async status => {
    const recommendation = { ...flag, id: 'recommendation', checkId: 'no-privacy-policy', severity: 'POLISH', status: 'REGRESSED' }
    mocks.auditFindUnique.mockResolvedValue({ id: 'review-2', userId: 'user-1', projectId: 'product-1', flags: [recommendation], rubrics: [] })
    mocks.improvementFindMany.mockResolvedValue([{ fingerprint: 'check:no-privacy-policy', priority: 50 }])
    mocks.improvementUpsert.mockResolvedValue({ id: 'existing-improvement', status })
    await materializeAttentionForAudit('review-2')
    expect(mocks.improvementFindMany).toHaveBeenCalledWith({ where: { projectId: 'product-1', fingerprint: { in: ['check:no-privacy-policy'] } },
      select: { fingerprint: true, priority: true } })
    expect(mocks.improvementUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId_fingerprint: { projectId: 'product-1', fingerprint: 'check:no-privacy-policy' } }, update: expect.objectContaining({ priority: 50 }),
    }))
    expect(mocks.occurrenceUpsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({
      improvementId: 'existing-improvement', auditId: 'review-2', flagId: 'recommendation', kind: 'REGRESSED',
    }) }))
    if (status === 'VERIFIED') expect(mocks.improvementUpdate).toHaveBeenCalledWith({ where: { id: 'existing-improvement' }, data: { status: 'PROPOSED' } })
    else expect(mocks.improvementUpdate).not.toHaveBeenCalled()
  })
  it('keeps unengaged recommendations and resolved observations outside automatic Improvement creation', async () => {
    mocks.auditFindUnique.mockResolvedValue({ id: 'review-2', userId: 'user-1', projectId: 'product-1', flags: [
      { ...flag, checkId: 'no-privacy-policy', severity: 'POLISH' },
      { ...flag, id: 'fixed', checkId: 'no-contact-info', severity: 'POLISH', status: 'FIXED' },
      { ...flag, id: 'ignored', checkId: 'cookie-consent-absent', severity: 'POLISH', status: 'IGNORED' },
    ], rubrics: [] })
    await materializeAttentionForAudit('review-2')
    expect(mocks.improvementFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 'product-1', fingerprint: { in: ['check:no-privacy-policy'] } } }))
    expect(mocks.improvementUpsert).not.toHaveBeenCalled()
    expect(mocks.occurrenceUpsert).not.toHaveBeenCalled()
  })
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

  it('materializes every customer Flag instead of truncating Site memory to the top three', async () => {
    const flags = Array.from({ length: 4 }, (_, index) => ({
      ...flag,
      id: `flag-${index + 1}`,
      checkId: `customer-check-${index + 1}`,
      problem: `Customer problem ${index + 1}`,
    }))
    mocks.auditFindUnique.mockResolvedValue({
      id: 'review-1',
      userId: 'user-1',
      projectId: 'product-1',
      url: 'https://example.com',
      productContract: null,
      flags,
      rubrics: [],
    })
    mocks.improvementUpsert.mockImplementation(async ({ create }) => ({
      id: `improvement-${create.fingerprint}`,
      status: 'PROPOSED',
    }))

    await materializeAttentionForAudit('review-1')

    expect(mocks.improvementUpsert).toHaveBeenCalledTimes(4)
    expect(mocks.occurrenceUpsert).toHaveBeenCalledTimes(4)
  })
})

describe('createImprovementAttempt', () => {
  it('refuses a changed owner or removed Site at the persistence boundary', async () => {
    mocks.improvementFindFirst.mockResolvedValue({ id: 'improvement-1' })
    mocks.queryRaw.mockResolvedValue([])
    await expect(createImprovementAttempt({ improvementId: 'improvement-1', projectId: 'product-1', userId: 'user-1',
      sourceAuditId: 'review-1', builder: 'site' })).rejects.toThrow('Improvement not found')
    expect(mocks.attemptCreate).not.toHaveBeenCalled()
    expect(mocks.improvementUpdate).not.toHaveBeenCalled()
  })
  const keyed = { improvementId: 'improvement-1', projectId: 'product-1', userId: 'user-1', sourceAuditId: 'review-1', builder: 'site',
    idempotencyKey: 'repair-intent-one', handoffReference: 'flag:flag-1', changeSummary: 'Restored the handler', commitReference: 'commit-one' }
  it.each([null, 'IMPROVED'])('replays a keyed repair without modifying its pending or completed history: %s', async outcome => {
    mocks.improvementFindFirst.mockResolvedValue({ id: 'improvement-1' })
    const recorded = { id: 'attempt-one', ...keyed, requestHash: attemptIntentHash(keyed), outcome }
    mocks.attemptFindUnique.mockResolvedValue(recorded)
    expect(await createImprovementAttempt({ ...keyed, builder: 'another-client' })).toEqual(recorded)
    expect(mocks.attemptCreate).not.toHaveBeenCalled(); expect(mocks.attemptUpdate).not.toHaveBeenCalled()
    expect(mocks.improvementUpdate).not.toHaveBeenCalled(); expect(mocks.improvementUpdateMany).not.toHaveBeenCalled()
    expect(mocks.cycleEventUpsert).not.toHaveBeenCalled()
  })
  it('refuses a changed keyed repair and persists commit provenance on a fresh intent', async () => {
    mocks.improvementFindFirst.mockResolvedValue({ id: 'improvement-1' })
    mocks.attemptFindUnique.mockResolvedValue({ id: 'attempt-one', requestHash: attemptIntentHash(keyed) })
    await expect(createImprovementAttempt({ ...keyed, commitReference: 'different-commit' })).rejects.toMatchObject({ code: 'FIX_INTENT_MISMATCH', status: 409 })
    expect(mocks.attemptCreate).not.toHaveBeenCalled()
    mocks.attemptFindUnique.mockResolvedValue(null); mocks.attemptCreate.mockResolvedValue({ id: 'attempt-two' })
    await createImprovementAttempt(keyed)
    expect(mocks.attemptCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      idempotencyKey: keyed.idempotencyKey, requestHash: attemptIntentHash(keyed), commitReference: keyed.commitReference,
    }) }))
  })
  it('starts a distinct repair instead of overwriting an attempt already admitted to a run', async () => {
    mocks.improvementFindFirst.mockResolvedValue({ id: 'improvement-1' })
    mocks.attemptFindFirst.mockResolvedValue({ id: 'attempt-one', verificationAuditId: 'running', changeSummary: 'Original repair' })
    mocks.attemptCreate.mockResolvedValue({ id: 'attempt-two' })
    expect(await createImprovementAttempt({ ...keyed, idempotencyKey: undefined })).toEqual({ id: 'attempt-two' })
    expect(mocks.attemptUpdate).not.toHaveBeenCalled()
  })
  it('preserves historical keyed receipts without reconstructing a missing request hash', async () => {
    mocks.improvementFindFirst.mockResolvedValue({ id: 'improvement-1' })
    const recorded = { id: 'historical', requestHash: null, outcome: 'IMPROVED' }
    mocks.attemptFindUnique.mockResolvedValue(recorded)
    expect(await createImprovementAttempt(keyed)).toEqual(recorded)
    expect(mocks.attemptCreate).not.toHaveBeenCalled()
    expect(mocks.improvementUpdate).not.toHaveBeenCalled()
  })
  it.each([false, true])('preserves a draft frozen by concurrent admission, changed repair: %s', async changed => {
    mocks.improvementFindFirst.mockResolvedValue({ id: 'improvement-1' })
    mocks.attemptFindFirst.mockResolvedValue({ id: 'attempt-one', changeSummary: 'Original repair' })
    mocks.attemptUpdateMany.mockResolvedValue({ count: 0 })
    const admitted = { id: 'attempt-one', frozen: true, verificationAuditId: 'running', changeSummary: 'Original repair' }
    mocks.attemptFindUniqueOrThrow.mockResolvedValue(admitted)
    mocks.attemptCreate.mockResolvedValue({ id: 'attempt-two' })
    const result = await createImprovementAttempt({ ...keyed, idempotencyKey: undefined,
      handoffReference: undefined, commitReference: undefined, changeSummary: changed ? 'Later repair' : 'Original repair' })
    expect(result).toEqual(changed ? { id: 'attempt-two' } : admitted)
    expect(mocks.attemptCreate).toHaveBeenCalledTimes(changed ? 1 : 0)
    expect(mocks.attemptUpdate).not.toHaveBeenCalled()
    if (!changed) expect(mocks.cycleEventUpsert).not.toHaveBeenCalled()
  })
  it('records an undescribed verification request without inventing a change or recovery', async () => {
    mocks.improvementFindFirst.mockResolvedValue({ id: 'improvement-1' })
    mocks.attemptCreate.mockResolvedValue({ id: 'attempt-1' })
    await createImprovementAttempt({ improvementId: 'improvement-1', projectId: 'product-1', userId: 'user-1', sourceAuditId: 'review-1', builder: 'site' })
    expect(mocks.attemptCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ changeSummary: null }) }))
    expect(mocks.improvementUpdate).toHaveBeenCalledWith({ where: { id: 'improvement-1' }, data: { status: 'READY_TO_VERIFY' } })
  })

  it('keeps the existing declared change when a pending verification request is repeated without one', async () => {
    mocks.improvementFindFirst.mockResolvedValue({ id: 'improvement-1' })
    mocks.attemptFindFirst.mockResolvedValue({ id: 'attempt-1' })
    mocks.attemptUpdate.mockResolvedValue({ id: 'attempt-1' })
    await createImprovementAttempt({ improvementId: 'improvement-1', projectId: 'product-1', userId: 'user-1', sourceAuditId: 'review-1', builder: 'site' })
    expect(mocks.attemptUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ changeSummary: undefined }) }))
  })

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
        where: expect.objectContaining({ project: { userId: 'user-1', deletedAt: null } }),
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

  it('updates an unkeyed, unadmitted draft for the same Improvement and source Review', async () => {
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
    expect(mocks.attemptUpdateMany).toHaveBeenCalledWith({
      where: { id: 'attempt-1', idempotencyKey: null, verificationAuditId: null, outcome: null, frozen: false },
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

  it('preserves the original bound declaration when a legacy Flag retry omits a description', async () => {
    mocks.flagFindFirst.mockResolvedValue(ownedFlag)
    mocks.improvementFindFirst.mockResolvedValue({ id: 'improvement-1' })
    mocks.attemptFindFirst.mockResolvedValue({ id: 'attempt-1', frozen: true, verificationAuditId: 'admitted-review',
      handoffReference: 'flag:flag-1', changeSummary: 'Original declared repair', commitReference: 'original-commit' })
    const result = await recordFlagImprovementAttempt({ flagId: 'flag-1', userId: 'user-1', builder: 'site', action: 'READY_TO_VERIFY' })
    expect(result).toMatchObject({ attemptId: 'attempt-1', changeSummary: 'Original declared repair', commitReference: 'original-commit' })
    expect(mocks.attemptCreate).not.toHaveBeenCalled()
    expect(mocks.attemptUpdateMany).not.toHaveBeenCalled()
    expect(mocks.cycleEventUpsert).not.toHaveBeenCalled()
  })

  it.each([0, 1])('converges native first-fix materialization without rewriting existing proposals, inserted occurrence: %s', async inserted => {
    mocks.flagFindFirst.mockResolvedValue({ ...ownedFlag, improvementOccurrence: null })
    mocks.improvementCreateMany.mockResolvedValue({ count: 0 })
    mocks.improvementFindUniqueOrThrow.mockResolvedValue({ id: 'improvement-1' })
    mocks.occurrenceCreateMany.mockResolvedValue({ count: inserted })
    mocks.occurrenceFindUniqueOrThrow.mockResolvedValue({ id: 'occurrence-1', improvementId: 'improvement-1' })
    mocks.improvementFindFirst.mockResolvedValue({ id: 'improvement-1' })
    mocks.attemptCreate.mockResolvedValue({ id: 'attempt-1' })
    const result = await recordFlagImprovementAttempt({ flagId: 'flag-1', userId: 'user-1', builder: 'site',
      action: 'READY_TO_VERIFY', idempotencyKey: 'repair-key', changeSummary: 'Restored the action' })
    expect(result).toMatchObject({ improvementId: 'improvement-1', attemptId: 'attempt-1' })
    expect(mocks.improvementCreateMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }))
    expect(mocks.occurrenceCreateMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }))
    expect(mocks.improvementUpsert).not.toHaveBeenCalled()
    expect(mocks.occurrenceUpsert).not.toHaveBeenCalled()
    const generated = mocks.cycleEventUpsert.mock.calls.filter(([value]) => value.create.type === 'GENERATED')
    expect(generated).toHaveLength(inserted)
    expect(mocks.flagFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: {
      id: 'flag-1', audit: { userId: 'user-1', projectId: 'product-1', project: { userId: 'user-1' } },
    } }))
  })

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
  it.each(['proved', 'missing', 'unrelated-source'] as const)('resumes a diagnostic fix across a gap from original recovery evidence: %s', async scenario => {
    const pageUrl = 'https://example.com/'
    mocks.auditFindUnique.mockResolvedValue({ id: 'after', parentId: 'gap', projectId: 'product-1', status: 'COMPLETED',
      startedAt: new Date('2026-10-12T12:00:00Z'), reportCompleteness: 'PARTIAL', evidenceCoverage: {}, failedModules: ['pagespeed'],
      journeyReviewIncluded: false, journeyReviewAt: null, pages: [], runRequests: [],
      executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
        checks: { 'viewport-missing': 1 }, outcomes: [], verificationTarget: null },
      verifierExecutions: scenario === 'missing' ? [] : [{ targetKey: 'module:metadata', scopeKey: 'page:' + pageUrl,
        status: 'COMPLETED', evidenceReference: { taskId: 'task' }, detail: { kind: 'site-module-check', version: 1, module: 'metadata', passed: true, applicable: true,
          pageUrl, execution: { auditId: 'after', taskId: 'task', checkVersion: 1, source: 'rendered-dom', collectedAt: '2026-10-12T12:00:00.000Z' },
          assertions: [{ key: 'viewport-presence', name: 'Viewport', expected: 'Present', observed: 'Present', passed: true }],
        } }],
    })
    mocks.flagFindMany.mockResolvedValue([])
    mocks.occurrenceFindMany.mockResolvedValue([])
    mocks.attemptFindMany.mockResolvedValue([{ id: 'attempt-1', improvementId: 'improvement-1', sourceAuditId: 'source', outcome: 'INCONCLUSIVE',
      improvement: { id: 'improvement-1', outcomeId: null, status: 'UNVERIFIED', fingerprint: 'check:viewport-missing', successCondition: 'Viewport restored' },
      sourceAudit: { improvementOccurrences: [{ id: 'occurrence-1', improvementId: 'improvement-1', auditId: 'source', flagId: 'flag-1',
        flag: { ...flag, checkId: 'viewport-missing', pageUrl, status: 'FIXED', resolvedInId: scenario === 'unrelated-source' ? 'other' : 'after' } }] },
    }])
    const results = await reconcileImprovementVerification({ parentAuditId: 'gap', verificationAuditId: 'after' })
    if (scenario === 'unrelated-source') expect(results).toEqual([])
    else expect(results[0]).toMatchObject({ outcome: scenario === 'proved' ? 'IMPROVED' : 'INCONCLUSIVE', comparable: scenario === 'proved' })
  })

  it.each(['recovery', 'changed-scope', 'unrelated-flag', 'no-transition', 'targeted', 'other-site', 'rejected'] as const)(
    'resumes an inconclusive owner fix only from committed source incident recovery: %s', async scenario => {
      const coverage = { environment: 'production', requiredBindings: ['signup'], observedBindings: ['signup'], scope: null,
        bindings: [{ key: 'signup', version: 1, mechanism: 'SAFE_FORM', config: { fixtureId: 'fixture-1' }, scope: null }] }
      const startedAt = new Date('2026-10-11T12:00:00Z')
      mocks.auditFindUnique.mockResolvedValue({ id: 'after', parentId: 'gap', projectId: 'product-1', productContract: null,
        status: 'COMPLETED', startedAt, reportCompleteness: 'PARTIAL', evidenceCoverage: {}, failedModules: [],
        pages: [], verifierExecutions: [], journeyReviewIncluded: false, journeyReviewAt: null,
        runRequests: [{ id: 'run', projectId: scenario === 'other-site' ? 'other' : 'product-1', status: 'COMPLETED', environment: 'production',
          verificationTarget: scenario === 'targeted' ? { kind: 'OUTCOME', attemptId: 'another-attempt' } : null,
          assessments: [{ outcomeId: 'signup-1', auditId: 'after', runRequestId: 'run', state: 'CLEAR', coverage, evidence: {
            reason: 'required_bindings_succeeded', incident: { version: 1, transition: scenario === 'no-transition' ? 'clear' : 'recovery',
              incidentRunRequestId: 'source-run', rootFlagIds: ['flag-1'], flagIds: [], recoveredFlagIds: ['flag-1'], previousAssessmentId: 'source-assessment' } } }],
        }],
      })
      mocks.occurrenceFindMany.mockResolvedValue([])
      mocks.flagFindMany.mockResolvedValue([])
      mocks.assessmentFindFirst.mockResolvedValue({ state: 'FLAG', coverage: scenario === 'changed-scope'
        ? { ...coverage, bindings: [{ ...coverage.bindings[0], version: 2 }] } : coverage })
      mocks.attemptFindMany.mockResolvedValue([{ id: 'attempt-1', improvementId: 'improvement-1', sourceAuditId: 'source',
        outcome: 'INCONCLUSIVE', createdAt: new Date('2026-10-11T11:00:00Z'),
        improvement: { id: 'improvement-1', status: scenario === 'rejected' ? 'REJECTED' : 'VERIFIED', outcomeId: 'signup-1',
          fingerprint: 'outcome:v1:signup-1:signup', successCondition: 'Signup completes' },
        sourceAudit: { improvementOccurrences: [{ id: 'occurrence-1', improvementId: 'improvement-1', auditId: 'source', flagId: 'flag-1',
          flag: { ...flag, status: 'FIXED', resolvedInId: scenario === 'unrelated-flag' ? 'another-audit' : 'after' } }] },
      }])
      const results = await reconcileImprovementVerification({ parentAuditId: 'gap', verificationAuditId: 'after' })
      if (scenario === 'recovery' || scenario === 'changed-scope') {
        expect(results[0]).toMatchObject({ outcome: scenario === 'recovery' ? 'IMPROVED' : 'INCONCLUSIVE' })
        expect(mocks.assessmentFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { auditId: 'source', outcomeId: 'signup-1' } }))
        expect(mocks.attemptFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
          createdAt: { lte: startedAt }, sourceAudit: { projectId: 'product-1', flags: { some: { status: 'FIXED', resolvedInId: 'after' } } },
        }) }))
        expect(mocks.attemptUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
          evidenceReference: { beforeAuditId: 'source', beforeFlagId: 'flag-1', afterAuditId: 'after', afterFlagId: null },
        }) }))
      } else {
        expect(results).toEqual([])
        expect(mocks.attemptUpdate).not.toHaveBeenCalled()
      }
    },
  )

  it.each(['passed', 'failed', 'missing'] as const)('settles a named older repair without changing the latest repair status: %s', async verdict => {
    const pageUrl = 'https://example.com'
    const targetedFlag = { ...flag, checkId: 'checkout-link-dead', pageUrl }
    mocks.auditFindUnique.mockResolvedValue({
      id: 'review-2', parentId: 'review-1', projectId: 'product-1', productContract: null,
      status: 'COMPLETED', reportCompleteness: 'PARTIAL', evidenceCoverage: {}, failedModules: [],
      journeyReviewIncluded: false, journeyReviewAt: null, pages: [],
      runRequests: [{ id: 'run', projectId: 'product-1', status: 'COMPLETED', environment: 'production', assessments: [],
        verificationTarget: { kind: 'DIAGNOSTIC', attemptId: 'attempt-1', parentAuditId: 'review-1', checkId: targetedFlag.checkId, pageUrl } }],
      verifierExecutions: verdict === 'missing' ? [] : [{ targetKey: 'check:checkout-link-dead', scopeKey: 'page:' + pageUrl,
        status: 'COMPLETED', evidenceReference: { taskId: 'check-task' }, detail: {
          kind: 'check-verifier', version: 1, auditId: 'review-2', taskId: 'check-task', checkId: targetedFlag.checkId,
          checkVersion: 1, pageUrl, source: 'http', collectedAt: '2026-10-11T12:00:00.000Z', comparable: true, verdict,
          assertion: { key: 'checkout-destination', name: 'Checkout destination', expected: 'Successful GET', observed: 'GET response', passed: verdict === 'passed', complete: true },
        } }],
    })
    mocks.flagFindMany.mockResolvedValue([])
    mocks.occurrenceFindMany.mockResolvedValue([{ id: 'occurrence-1', auditId: 'review-1', improvementId: 'improvement-1', flagId: 'flag-1', flag: targetedFlag,
      improvement: { successCondition: 'The same destination responds', attempts: [{ id: 'attempt-1', sourceAuditId: 'review-1' }] } }])
    mocks.attemptFindFirst.mockResolvedValue({ id: 'newer-attempt' })
    const results = await reconcileImprovementVerification({ parentAuditId: 'review-1', verificationAuditId: 'review-2' })
    expect(results[0].outcome).toBe(verdict === 'passed' ? 'IMPROVED' : verdict === 'failed' ? 'UNCHANGED' : 'INCONCLUSIVE')
    expect(mocks.occurrenceFindMany).toHaveBeenCalledWith(expect.objectContaining({ include: expect.objectContaining({
      improvement: { include: { attempts: expect.objectContaining({ where: {
        outcome: null, sourceAuditId: 'review-1', id: 'attempt-1',
      }, take: 1 }) } },
    }) }))
    expect(mocks.attemptUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'attempt-1' } }))
    expect(mocks.improvementUpdate).not.toHaveBeenCalled()
    if (verdict === 'passed') expect(mocks.flagUpdateMany).toHaveBeenCalledWith({
      where: { id: 'flag-1', auditId: 'review-1', audit: { projectId: 'product-1' }, status: { in: ['OPEN', 'REGRESSED'] } },
      data: { status: 'FIXED', resolvedInId: 'review-2' },
    })
    else expect(mocks.flagUpdateMany).not.toHaveBeenCalled()
  })

  it.each(['failed-peer', 'missing-peer', 'repaired'] as const)('reconciles the original multi-page Flag instead of its passing representative: %s', async scenario => {
    const pageUrl = 'https://example.com/', peer = 'https://example.com/pricing'
    const scoped = [pageUrl, peer].map(url => runPerformanceChecks(healthyDesktopPs({ lcp: 3000,
      diagnostics: { measurement: pageSpeedMeasurementFixture(url) } }), null, url)[0])
    const original = { ...flag, ...scoped[0], pageUrl, affectedPaths: [pageUrl, peer],
      evidenceTargets: scoped.flatMap(flag => flag.evidenceTargets ?? []) }
    const receipt = (url: string, passed: boolean) => ({ targetKey: 'module:performance', scopeKey: 'page:' + url,
      status: 'COMPLETED', evidenceReference: { taskId: url }, detail: {
        kind: 'site-module-check', version: 1, module: 'performance', pageUrl: url, applicable: true, passed, complete: true,
        execution: { auditId: 'review-2', taskId: url, checkVersion: 1, source: 'pagespeed-desktop', collectedAt: '2026-10-12T12:00:00.000Z' },
        assertions: scopePerformanceAssertions(healthyDesktopPs({ diagnostics: { measurement: pageSpeedMeasurementFixture(url) } }), url,
          [{ key: 'lcp', name: 'LCP', expected: 'Fast loading', observed: passed ? '1000ms' : '6000ms', passed, complete: true }]),
      } })
    const main = receipt(pageUrl, true)
    const exact = { ...main, targetKey: 'check:lcp-poor', scopeKey: 'page:https://example.com', detail: {
      kind: 'check-verifier', version: 1, ...main.detail.execution, checkId: 'lcp-poor', pageUrl,
      comparable: true, verdict: 'passed', assertion: main.detail.assertions[0],
    } }
    mocks.auditFindUnique.mockResolvedValue({ id: 'review-2', parentId: 'review-1', projectId: 'product-1', productContract: null,
      status: 'COMPLETED', reportCompleteness: 'PARTIAL', evidenceCoverage: {}, failedModules: [],
      journeyReviewIncluded: false, journeyReviewAt: null, pages: [],
      executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'DIAGNOSTIC',
        checks: { 'lcp-poor': 1 }, outcomes: [], verificationTarget: null },
      runRequests: [{ id: 'run', projectId: 'product-1', status: 'COMPLETED', environment: 'production', assessments: [],
        verificationTarget: { kind: 'DIAGNOSTIC', attemptId: 'attempt-1', parentAuditId: 'review-1', checkId: original.checkId, pageUrl } }],
      verifierExecutions: [main, exact, ...(scenario === 'missing-peer' ? [] : [receipt(peer, scenario === 'repaired')])],
    })
    mocks.flagFindMany.mockResolvedValue(scenario === 'failed-peer' ? [{ ...original, id: 'child-peer', pageUrl: peer }] : [])
    mocks.occurrenceFindMany.mockResolvedValue([{ id: 'occurrence-1', auditId: 'review-1', improvementId: 'improvement-1', flagId: original.id,
      flag: original, improvement: { fingerprint: improvementFingerprint(original), successCondition: original.verificationRule,
        attempts: [{ id: 'attempt-1', sourceAuditId: 'review-1' }] } }])
    const results = await reconcileImprovementVerification({ parentAuditId: 'review-1', verificationAuditId: 'review-2' })
    expect(results[0]).toMatchObject({ outcome: scenario === 'failed-peer' ? 'UNCHANGED' : scenario === 'missing-peer' ? 'INCONCLUSIVE' : 'IMPROVED',
      comparable: scenario !== 'missing-peer' })
    if (scenario !== 'repaired') {
      expect(mocks.flagUpdateMany).not.toHaveBeenCalled()
      expect(mocks.appendVerifiedLearning).not.toHaveBeenCalled()
    }
  })

  it.each([0, 1])('records exact repair success without closing other unresolved occurrences: %s remaining', async unresolved => {
    mocks.flagFindFirst.mockResolvedValue(unresolved ? { id: 'still-open' } : null)
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
        id: 'occurrence-1', auditId: 'review-1',
        flagId: 'flag-1',
        flag,
        improvement: {
          successCondition: flag.verificationRule,
          attempts: [{ id: 'attempt-1', sourceAuditId: 'review-1' }],
        },
      },
    ])

    const results = await reconcileImprovementVerification({
      parentAuditId: 'review-1',
      verificationAuditId: 'review-2',
    })

    expect(results).toEqual([
      expect.objectContaining({ outcome: 'IMPROVED', status: unresolved ? 'PROPOSED' : 'VERIFIED' }),
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
      id: 'occurrence-1', auditId: 'review-1',
      flagId: 'flag-1',
      flag,
      improvement: {
        successCondition: flag.verificationRule,
        attempts: [{ id: 'attempt-1', sourceAuditId: 'review-1' }],
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
