import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  outcomeFindMany: vi.fn(),
  runFindUnique: vi.fn(),
  runFindFirst: vi.fn(),
  runFindMany: vi.fn(),
  runCreate: vi.fn(),
  runUpdate: vi.fn(),
  runCount: vi.fn(),
  auditFindFirst: vi.fn(),
  flagFindFirst: vi.fn(),
  improvementFindFirst: vi.fn(),
  assessmentUpsert: vi.fn(),
  executionFindMany: vi.fn(),
  createAudit: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    siteOutcome: { findMany: mocks.outcomeFindMany },
    runRequest: {
      findUnique: mocks.runFindUnique,
      findFirst: mocks.runFindFirst,
      findMany: mocks.runFindMany,
      create: mocks.runCreate,
      update: mocks.runUpdate,
      count: mocks.runCount,
    },
    audit: { findFirst: mocks.auditFindFirst },
    flag: { findFirst: mocks.flagFindFirst },
    improvement: { findFirst: mocks.improvementFindFirst },
    outcomeAssessment: { upsert: mocks.assessmentUpsert },
    outcomeBindingExecution: { findMany: mocks.executionFindMany },
  },
}))
vi.mock('@/lib/audit/create-audit', () => ({
  createAndEnqueueAudit: mocks.createAudit,
}))
vi.mock('@/lib/analytics/site-events', () => ({
  recordSiteLifecycleEvent: vi.fn().mockResolvedValue({}),
}))

import { getOwnedRun, reconcileOutcomeRunsForAudit, requestOutcomeRun, requestSiteRun } from '@/lib/sites/application/run-requests'

const ownedOutcome = {
  id: 'outcome-1',
  kind: 'CHECKOUT',
  environment: 'production',
  projectId: 'project-1',
  project: { url: 'https://shop.example/' },
  bindings: [{ required: true, config: { startUrl: 'https://shop.example/products/widget' } }],
}

describe('RunRequest tenant boundary and idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.outcomeFindMany.mockResolvedValue([ownedOutcome])
    mocks.runFindUnique.mockResolvedValue(null)
    mocks.runFindFirst.mockResolvedValue(null)
    mocks.runCreate.mockResolvedValue({ id: 'run-1' })
    mocks.auditFindFirst.mockResolvedValue({ id: 'audit-parent' })
    mocks.createAudit.mockResolvedValue({ auditId: 'audit-1', reused: false })
    mocks.runUpdate.mockResolvedValue({})
    mocks.runCount.mockResolvedValue(0)
    mocks.flagFindFirst.mockResolvedValue(null)
    mocks.improvementFindFirst.mockResolvedValue(null)
    mocks.assessmentUpsert.mockResolvedValue({})
    mocks.executionFindMany.mockResolvedValue([])
  })

  it('refuses a run when no Outcome is selected and does not enqueue an Audit', async () => {
    await expect(
      requestSiteRun({
        projectId: 'project-1',
        outcomeIds: [],
        userId: 'user-1',
        source: 'WATCH',
      }),
    ).rejects.toThrow('Select at least one Outcome')
    expect(mocks.runCreate).not.toHaveBeenCalled()
    expect(mocks.createAudit).not.toHaveBeenCalled()
  })

  it('checks the Outcome, Project, and authenticated owner in one query', async () => {
    await requestOutcomeRun({
      projectId: 'project-1',
      outcomeId: 'outcome-1',
      userId: 'user-1',
      source: 'MCP',
      idempotencyKey: 'mcp:checkout:one',
    })

    expect(mocks.outcomeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['outcome-1'] },
          projectId: 'project-1',
          project: { userId: 'user-1', deletedAt: null },
        }),
      }),
    )
    expect(mocks.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        runRequestId: 'run-1',
        reuseActiveManual: false,
        attribution: expect.objectContaining({ source: 'MCP' }),
      }),
    )
  })

  it('does not reveal or run an Outcome outside the authenticated tenant', async () => {
    mocks.outcomeFindMany.mockResolvedValue([])
    await expect(
      requestOutcomeRun({
        projectId: 'project-a',
        outcomeId: 'outcome-b',
        userId: 'user-a',
        source: 'MCP',
      }),
    ).rejects.toThrow('Outcome not found')
    expect(mocks.runCreate).not.toHaveBeenCalled()
    expect(mocks.createAudit).not.toHaveBeenCalled()
  })

  it('keeps broad Site care when Watch also verifies Checkout', async () => {
    await requestOutcomeRun({
      projectId: 'project-1',
      outcomeId: 'outcome-1',
      userId: 'user-1',
      source: 'WATCH',
    })
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://shop.example/',
      monitoringMode: 'FULL',
      auditMode: 'CRITICAL_PATH',
      recheckTrigger: 'WATCH',
    }))
  })

  it('selects two owned Outcomes under one request and one physical Audit', async () => {
    mocks.outcomeFindMany.mockResolvedValue([
      ownedOutcome,
      { ...ownedOutcome, id: 'outcome-2', kind: 'AVAILABILITY' },
    ])
    const result = await requestSiteRun({
      projectId: 'project-1',
      outcomeIds: ['outcome-2', 'outcome-1', 'outcome-2'],
      userId: 'user-1',
      source: 'WATCH',
      idempotencyKey: 'watch:project-1:cycle-1',
    })

    expect(result.outcomeIds).toEqual(['outcome-1', 'outcome-2'])
    expect(mocks.runCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        outcomeId: 'outcome-1',
        selections: {
          create: [{ outcomeId: 'outcome-1' }, { outcomeId: 'outcome-2' }],
        },
      }),
    }))
    expect(mocks.createAudit).toHaveBeenCalledTimes(1)
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://shop.example/',
      monitoringMode: 'FULL',
    }))
  })

  it('reuses the same tenant-scoped idempotency key without enqueueing twice', async () => {
    mocks.runFindUnique.mockResolvedValue({
      id: 'run-existing',
      projectId: 'project-1',
      outcomeId: 'outcome-1',
      environment: 'production',
      selections: [{ outcomeId: 'outcome-1' }],
      auditId: 'audit-existing',
    })
    await expect(
      requestOutcomeRun({
        projectId: 'project-1',
        outcomeId: 'outcome-1',
        userId: 'user-1',
        source: 'WEB',
        idempotencyKey: 'web:checkout:same',
      }),
    ).resolves.toEqual({
      runId: 'run-existing',
      auditId: 'audit-existing',
      outcomeIds: ['outcome-1'],
      reused: true,
    })
    expect(mocks.runFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        projectId_source_idempotencyKey: {
          projectId: 'project-1',
          source: 'WEB',
          idempotencyKey: 'web:checkout:same',
        },
      },
    }))
    expect(mocks.runCreate).not.toHaveBeenCalled()
    expect(mocks.runCount).not.toHaveBeenCalled()
  })

  it('rejects reuse of a key for a different Outcome on the same Site', async () => {
    mocks.runFindUnique.mockResolvedValue({
      id: 'run-existing',
      projectId: 'project-1',
      outcomeId: 'outcome-other',
      environment: 'production',
      selections: [{ outcomeId: 'outcome-other' }],
      auditId: 'audit-existing',
    })
    await expect(requestOutcomeRun({
      projectId: 'project-1', outcomeId: 'outcome-1', userId: 'user-1',
      source: 'WEB', idempotencyKey: 'web:checkout:same',
    })).rejects.toThrow('belongs to another Outcome selection')
    expect(mocks.runCreate).not.toHaveBeenCalled()
  })

  it('bounds interactive verification without limiting scheduled Watch', async () => {
    mocks.runCount.mockResolvedValue(24)
    await expect(requestOutcomeRun({
      projectId: 'project-1', outcomeId: 'outcome-1', userId: 'user-1', source: 'MCP',
    })).rejects.toThrow('Too many requests')
    expect(mocks.runCreate).not.toHaveBeenCalled()

    await requestOutcomeRun({
      projectId: 'project-1', outcomeId: 'outcome-1', userId: 'user-1', source: 'WATCH',
    })
    expect(mocks.runCreate).toHaveBeenCalledTimes(1)
  })

  it('reads a completed worker result without reconciling or changing run state', async () => {
    mocks.runFindFirst.mockResolvedValue({
      id: 'run-1',
      source: 'MCP',
      status: 'COMPLETED',
      outcomeId: 'outcome-1',
      outcome: { name: 'Checkout' },
      selections: [{ outcomeId: 'outcome-1', outcome: { name: 'Checkout' } }],
      assessments: [{
        outcomeId: 'outcome-1',
        state: 'CLEAR',
        summary: 'Checkout reached.',
        assessedAt: new Date('2026-09-21T00:01:00.000Z'),
        validUntil: new Date('2099-01-01T00:00:00.000Z'),
      }],
      auditId: 'audit-1',
      audit: { status: 'COMPLETED', progress: 100, improvementProjectedAt: new Date() },
      requestedAt: new Date('2026-09-21T00:00:00.000Z'),
      completedAt: new Date('2026-09-21T00:01:00.000Z'),
      errorMessage: null,
    })

    const result = await getOwnedRun('user-1', 'run-1')

    expect(result?.result).toBe('CLEAR')
    expect(mocks.runFindFirst).toHaveBeenCalledTimes(1)
    expect(mocks.runUpdate).not.toHaveBeenCalled()
  })

  it('does not report a multi-Outcome run Clear when one selected Outcome is inconclusive', async () => {
    mocks.runFindFirst.mockResolvedValue({
      id: 'run-1', source: 'WATCH', status: 'COMPLETED',
      outcomeId: 'checkout-1', outcome: { name: 'Checkout' },
      selections: [
        { outcomeId: 'checkout-1', outcome: { name: 'Checkout' } },
        { outcomeId: 'form-1', outcome: { name: 'Signup' } },
      ],
      assessments: [
        { outcomeId: 'checkout-1', state: 'CLEAR', summary: 'Checkout reached.',
          assessedAt: new Date('2026-09-21T00:01:00.000Z'), validUntil: new Date('2099-01-01T00:00:00.000Z') },
        { outcomeId: 'form-1', state: 'COULD_NOT_VERIFY', summary: 'No safe completion.',
          assessedAt: new Date('2026-09-21T00:01:00.000Z'), validUntil: new Date('2026-09-21T00:01:00.000Z') },
      ],
      auditId: 'audit-1', audit: { progress: 100 },
      requestedAt: new Date('2026-09-21T00:00:00.000Z'),
      completedAt: new Date('2026-09-21T00:01:00.000Z'), errorMessage: null,
    })

    const result = await getOwnedRun('user-1', 'run-1')

    expect(result?.result).toBe('COULD_NOT_VERIFY')
    expect(result?.outcomes.map((outcome) => outcome.result)).toEqual(['CLEAR', 'COULD_NOT_VERIFY'])
  })

  it('does not treat a stored journey as Clear without a binding execution', async () => {
    mocks.runFindMany.mockResolvedValue([{
      id: 'run-1', projectId: 'project-1', requestedByUserId: 'user-1',
      source: 'WATCH', environment: 'production', requestedAt: new Date(),
      selections: [
        { outcomeId: 'checkout-1', outcome: {
          id: 'checkout-1', kind: 'CHECKOUT', staleAfterMinutes: 60,
          bindings: [{ key: 'checkout-browser-v1', required: true, mechanism: 'BROWSER_JOURNEY', scope: { device: 'mobile' } }],
        } },
        { outcomeId: 'form-1', outcome: {
          id: 'form-1', kind: 'GENERIC', staleAfterMinutes: 60,
          bindings: [{ key: 'form-browser-v1', required: true, mechanism: 'BROWSER_JOURNEY', scope: null }],
        } },
      ],
      audit: { journeyReviews: [{ id: 'journey-1', goalAchieved: true, steps: [] }] },
    }])

    await reconcileOutcomeRunsForAudit('audit-1')

    expect(mocks.assessmentUpsert).toHaveBeenCalledTimes(2)
    expect(mocks.assessmentUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        outcomeId: 'checkout-1',
        state: 'COULD_NOT_VERIFY',
        coverage: expect.objectContaining({ observedBindings: [] }),
      }),
    }))
    expect(mocks.assessmentUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        outcomeId: 'form-1',
        state: 'COULD_NOT_VERIFY',
        coverage: expect.objectContaining({ observedBindings: [] }),
      }),
    }))
    expect(mocks.runUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETED' }),
    }))
  })

  it('requires every recorded binding before Clear and keeps a blocked form inconclusive', async () => {
    mocks.executionFindMany.mockImplementation(async ({ where }: { where: { outcomeId: string } }) => {
      if (where.outcomeId === 'checkout-1') {
        return [{ bindingKey: 'checkout-browser-v1', disposition: 'SUCCEEDED', reason: 'checkout_reached' }]
      }
      return [{ bindingKey: 'form-browser-v1', disposition: 'BLOCKED', reason: 'protected_or_irreversible' }]
    })
    mocks.runFindMany.mockResolvedValue([{
      id: 'run-1', projectId: 'project-1', requestedByUserId: 'user-1',
      source: 'WATCH', environment: 'production', requestedAt: new Date(),
      selections: [
        { outcomeId: 'checkout-1', outcome: {
          id: 'checkout-1', kind: 'CHECKOUT', bindingPolicy: 'ALL_REQUIRED', staleAfterMinutes: 60,
          bindings: [{ key: 'checkout-browser-v1', required: true, mechanism: 'BROWSER_JOURNEY', scope: null }],
        } },
        { outcomeId: 'form-1', outcome: {
          id: 'form-1', kind: 'SIGNUP', bindingPolicy: 'ALL_REQUIRED', staleAfterMinutes: 60,
          bindings: [{ key: 'form-browser-v1', required: true, mechanism: 'SAFE_FORM', scope: null }],
        } },
      ],
      audit: { journeyReviews: [] },
    }])

    await reconcileOutcomeRunsForAudit('audit-1')

    expect(mocks.assessmentUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ outcomeId: 'checkout-1', state: 'CLEAR' }),
    }))
    expect(mocks.assessmentUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        outcomeId: 'form-1',
        state: 'COULD_NOT_VERIFY',
        summary: 'This flow is protected, so FixFlags did not submit it.',
      }),
    }))
  })
})
