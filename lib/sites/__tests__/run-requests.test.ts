import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/queue/execution-readiness', () => ({ requireExecutionReady: vi.fn().mockResolvedValue(undefined) }))

const mocks = vi.hoisted(() => ({
  outcomeFindMany: vi.fn(),
  projectFindFirst: vi.fn(),
  runFindUnique: vi.fn(),
  runFindFirst: vi.fn(),
  runFindMany: vi.fn(),
  runCreate: vi.fn(),
  runUpdate: vi.fn(),
  runUpdateMany: vi.fn(),
  runCount: vi.fn(),
  auditFindFirst: vi.fn(),
  auditFindUnique: vi.fn(),
  flagFindFirst: vi.fn(),
  improvementFindFirst: vi.fn(),
  assessmentUpsert: vi.fn(),
  executionFindMany: vi.fn(),
  createAudit: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    siteOutcome: { findMany: mocks.outcomeFindMany },
    project: { findFirst: mocks.projectFindFirst },
    runRequest: {
      findUnique: mocks.runFindUnique,
      findFirst: mocks.runFindFirst,
      findMany: mocks.runFindMany,
      create: mocks.runCreate,
      update: mocks.runUpdate,
      updateMany: mocks.runUpdateMany,
      count: mocks.runCount,
    },
    audit: { findFirst: mocks.auditFindFirst, findUnique: mocks.auditFindUnique },
    flag: { findFirst: mocks.flagFindFirst },
    improvement: { findFirst: mocks.improvementFindFirst },
    outcomeAssessment: { upsert: mocks.assessmentUpsert },
    outcomeBindingExecution: { findMany: mocks.executionFindMany },
  },
}))
vi.mock('@/lib/audit/create-audit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/audit/create-audit')>('@/lib/audit/create-audit')
  return { ...actual, createAndEnqueueAudit: mocks.createAudit }
})
vi.mock('@/lib/analytics/site-events', () => ({
  recordSiteLifecycleEvent: vi.fn().mockResolvedValue({}),
}))

import { summaryFor } from '@/lib/sites/application/binding-assessment'
import { getOwnedRun, reconcileOutcomeRunsForAudit, requestOutcomeRun, requestSiteRun, retryFailedExecution } from '@/lib/sites/application/run-requests'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
import { checkoutResultCopy } from '@/lib/sites/outcome-state'

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
    mocks.projectFindFirst.mockResolvedValue({ url: 'https://shop.example/' })
    mocks.runFindUnique.mockResolvedValue(null)
    mocks.runFindFirst.mockResolvedValue(null)
    mocks.runCreate.mockResolvedValue({ id: 'run-1' })
    mocks.auditFindFirst.mockResolvedValue({ id: 'audit-parent' })
    mocks.createAudit.mockResolvedValue({ auditId: 'audit-1', reused: false })
    mocks.runUpdate.mockResolvedValue({})
    mocks.runCount.mockResolvedValue(0)
    mocks.runFindMany.mockResolvedValue([])
    mocks.runUpdateMany.mockResolvedValue({ count: 1 })
    mocks.auditFindUnique.mockResolvedValue(null)
    mocks.flagFindFirst.mockResolvedValue(null)
    mocks.improvementFindFirst.mockResolvedValue(null)
    mocks.assessmentUpsert.mockResolvedValue({})
    mocks.executionFindMany.mockResolvedValue([])
  })

  it('refuses an empty Outcome run when Site care was not explicitly requested', async () => {
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

  it('runs broad Site care through the same durable request and Audit ledger', async () => {
    mocks.outcomeFindMany.mockResolvedValue([])

    const result = await requestSiteRun({
      projectId: 'project-1',
      outcomeIds: [],
      userId: 'user-1',
      source: 'WEB',
      scope: 'SITE',
      idempotencyKey: 'web:site-care:one',
      context: { action: 'run_site_care' },
    })

    expect(result).toEqual({ runId: 'run-1', auditId: 'audit-1', outcomeIds: [], reused: false })
    expect(mocks.runCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        projectId: 'project-1',
        legacyOutcomeId: null,
        source: 'WEB',
        selections: undefined,
        context: { action: 'run_site_care' },
      }),
    }))
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://shop.example/',
      parentId: 'audit-parent',
      recheckTrigger: 'MANUAL',
      runRequestId: 'run-1',
      // A user-initiated whole-Site re-scan is the one action a plan allowance
      // can honestly mean, so it is the one action that counts.
      skipUsageCount: false,
    }))
  })

  it('does not charge the allowance for an Outcome verification', async () => {
    // Verify is the Flag -> Fix -> Verify loop. Charging for it would tax the
    // exact behaviour the product exists to produce and would strand someone
    // who shipped a fix but could not then prove it.
    await requestSiteRun({
      projectId: 'project-1',
      outcomeIds: ['outcome-1'],
      userId: 'user-1',
      source: 'WEB',
      scope: 'OUTCOMES',
      idempotencyKey: 'web:checkout:verify',
    })

    expect(mocks.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({ skipUsageCount: true }),
    )
  })

  it('does not charge the allowance for a scheduled Watch run', async () => {
    // Every pricing surface promises Free "verified weekly". Metering the
    // schedule would make that promise false on the plan least able to absorb it.
    await requestSiteRun({
      projectId: 'project-1',
      outcomeIds: ['outcome-1'],
      userId: 'user-1',
      source: 'WATCH',
      idempotencyKey: 'watch:project-1:tick:outcome-1',
    })

    expect(mocks.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({ skipUsageCount: true, recheckTrigger: 'WATCH' }),
    )
  })

  it('records the plan limit as the failure reason instead of a start failure', async () => {
    mocks.outcomeFindMany.mockResolvedValue([])
    const { AuditLimitError } = await import('@/lib/audit/create-audit')
    mocks.createAudit.mockRejectedValueOnce(
      new AuditLimitError('UPGRADE_REQUIRED', { message: 'This period’s analyses are used up' }),
    )

    await expect(requestSiteRun({
      projectId: 'project-1',
      outcomeIds: [],
      userId: 'user-1',
      source: 'WEB',
      scope: 'SITE',
      idempotencyKey: 'web:site-care:blocked',
    })).rejects.toThrow('This period’s analyses are used up')

    // Reporting "could not start" for a spent allowance is both false and leaves
    // the customer with nothing to do about it.
    expect(mocks.runUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorCode: 'UPGRADE_REQUIRED',
        errorMessage: 'This period’s analyses are used up',
      }),
    }))
  })

  it('does not reuse an active Flag verification as a broad Site-care run', async () => {
    mocks.outcomeFindMany.mockResolvedValue([])
    mocks.runFindFirst.mockResolvedValueOnce({
      id: 'run-diagnostic',
      environment: 'production',
      auditId: 'audit-diagnostic',
      selections: [],
      verificationTarget: {
        kind: 'DIAGNOSTIC',
        pageUrl: 'https://shop.example/contact',
        checkId: 'form-feedback',
        attemptId: 'attempt-1',
        parentAuditId: 'audit-parent',
      },
    })

    const pending = requestSiteRun({
      projectId: 'project-1',
      outcomeIds: [],
      userId: 'user-1',
      source: 'WEB',
      scope: 'SITE',
      idempotencyKey: 'web:site-care:two',
    })
    await expect(pending).rejects.toBeInstanceOf(SiteRunRefusal)
    await expect(pending).rejects.toMatchObject({
      message: 'Another Site run is already in progress',
      status: 409,
    })

    expect(mocks.runCreate).not.toHaveBeenCalled()
    expect(mocks.createAudit).not.toHaveBeenCalled()
  })

  it('runs a diagnostic verification only against its originating page and check scope', async () => {
    mocks.outcomeFindMany.mockResolvedValue([])
    const result = await requestSiteRun({
      projectId: 'project-1',
      outcomeIds: [],
      userId: 'user-1',
      source: 'MCP',
      idempotencyKey: 'diagnostic:flag-1:attempt-1',
      verificationTarget: {
        kind: 'DIAGNOSTIC',
        pageUrl: 'https://shop.example/contact',
        checkId: 'form-feedback',
        attemptId: 'attempt-1',
        parentAuditId: 'audit-parent',
      },
    })

    expect(result.outcomeIds).toEqual([])
    expect(mocks.runCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        legacyOutcomeId: null,
        selections: undefined,
        verificationTarget: expect.objectContaining({ kind: 'DIAGNOSTIC', checkId: 'form-feedback' }),
      }),
    }))
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://shop.example/contact',
      parentId: 'audit-parent',
      verificationAttemptId: 'attempt-1',
    }))
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
        legacyOutcomeId: 'outcome-1',
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
    })).rejects.toThrow('belongs to another Site run')
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

  it('completes broad Site care without inventing an Outcome assessment', async () => {
    mocks.runFindMany.mockResolvedValue([{
      id: 'run-care', projectId: 'project-1', requestedByUserId: 'user-1',
      source: 'WEB', environment: 'production', requestedAt: new Date(),
      selections: [], audit: { journeyReviews: [] },
    }])

    await reconcileOutcomeRunsForAudit('audit-care')

    expect(mocks.assessmentUpsert).not.toHaveBeenCalled()
    expect(mocks.runUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'run-care' },
      data: expect.objectContaining({ status: 'COMPLETED', leaseUntil: null }),
    }))
  })

  it('retries failed broad Site care through a fresh shared run', async () => {
    mocks.auditFindUnique.mockResolvedValue({
      id: 'audit-care', url: 'https://shop.example/', userId: 'user-1',
      projectId: 'project-1', status: 'FAILED',
    })
    mocks.runFindFirst
      .mockResolvedValueOnce({ id: 'run-care', selections: [], verificationTarget: null })
      .mockResolvedValueOnce(null)
    mocks.outcomeFindMany.mockResolvedValue([])
    mocks.createAudit.mockResolvedValue({ auditId: 'audit-care-retry', reused: false })

    const result = await retryFailedExecution('audit-care')

    expect(result).toEqual({ ok: true, auditId: 'audit-care-retry', runId: 'run-1' })
    expect(mocks.runCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ projectId: 'project-1', source: 'INTERNAL', selections: undefined }),
    }))
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://shop.example/', runRequestId: 'run-1',
    }))
  })

  function checkoutRun(executions: { bindingKey: string; disposition: string; reason: string }[]) {
    mocks.executionFindMany.mockResolvedValue(executions)
    mocks.runFindMany.mockResolvedValue([{
      id: 'run-1', projectId: 'project-1', requestedByUserId: 'user-1',
      source: 'WEB', environment: 'production', requestedAt: new Date(),
      selections: [{
        outcomeId: 'checkout-1',
        outcome: {
          id: 'checkout-1', kind: 'CHECKOUT', bindingPolicy: 'ALL_REQUIRED', staleAfterMinutes: 60,
          bindings: [{ key: 'checkout-browser-v1', required: true, mechanism: 'BROWSER_JOURNEY', scope: null }],
        },
      }],
      audit: { journeyReviews: [] },
    }])
  }

  it('tells the customer why a blocked Checkout could not be verified', async () => {
    checkoutRun([{ bindingKey: 'checkout-browser-v1', disposition: 'BLOCKED', reason: 'no_buy_control' }])

    await reconcileOutcomeRunsForAudit('audit-1')

    expect(mocks.assessmentUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        outcomeId: 'checkout-1',
        state: 'COULD_NOT_VERIFY',
        summary: checkoutResultCopy('no_buy_control').summary,
      }),
    }))
    expect(checkoutResultCopy('no_buy_control').summary).not.toBe(
      summaryFor('required_coverage_incomplete', 'COULD_NOT_VERIFY'),
    )
  })

  it('uses the same purchase explanation for a bot wall', async () => {
    checkoutRun([{ bindingKey: 'checkout-browser-v1', disposition: 'BLOCKED', reason: 'bot_wall' }])

    await reconcileOutcomeRunsForAudit('audit-1')

    expect(mocks.assessmentUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        state: 'COULD_NOT_VERIFY',
        summary: checkoutResultCopy('bot_wall').summary,
      }),
    }))
  })

  it('keeps coverage language when Checkout never ran', async () => {
    checkoutRun([])

    await reconcileOutcomeRunsForAudit('audit-1')

    expect(mocks.assessmentUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        state: 'COULD_NOT_VERIFY',
        summary: summaryFor('required_coverage_incomplete', 'COULD_NOT_VERIFY'),
      }),
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
  describe('stale run recovery', () => {
    // A run stranded by a worker death stays QUEUED or RUNNING. Because both
    // count as active, it blocks its Site forever and later requests are handed
    // the stale auditId instead of a fresh verification, so Watch silently stops
    // verifying anything.
    const staleRun = {
      id: 'run-stale',
      projectId: 'project-1',
      environment: 'production',
      selections: [{ outcomeId: 'outcome-1' }],
      auditId: 'audit-stale',
      status: 'RUNNING',
      leaseUntil: new Date(Date.now() - 60_000),
    }

    beforeEach(() => {
      mocks.runFindUnique.mockResolvedValue(null)
    })

    /** Whether a real `runRequest.findFirst` would return this row. */
    function matchesRunQuery(
      row: { projectId: string; status: string; leaseUntil: Date | null },
      where: {
        projectId?: string
        status?: { in?: string[] }
        leaseUntil?: { gt?: Date }
      },
    ): boolean {
      if (where.projectId !== undefined && where.projectId !== row.projectId) return false
      const statuses = where.status?.in
      if (statuses && !statuses.includes(row.status)) return false
      const cutoff = where.leaseUntil?.gt
      if (cutoff === undefined) return true
      // Only a live lease is in flight; NULL and expired are not.
      return row.leaseUntil !== null && row.leaseUntil > cutoff
    }

    it('does not treat a run with an expired lease as active', async () => {
      // Answer as the database would: match the row only if the query's lease
      // predicate accepts it. A mock that ignores the where clause returns a
      // row the real query would exclude, which hides the defect.
      mocks.runFindFirst.mockImplementation(async ({ where }) =>
        matchesRunQuery(staleRun, where) ? staleRun : null)
      mocks.createAudit.mockResolvedValue({ auditId: 'audit-new', reused: false })

      const result = await requestOutcomeRun({
        projectId: 'project-1', outcomeId: 'outcome-1', userId: 'user-1',
        source: 'WATCH', idempotencyKey: 'watch:project-1:tick',
      })

      // A fresh verification is started rather than the stale run being reused.
      expect(result.reused).toBe(false)
      expect(mocks.createAudit).toHaveBeenCalledTimes(1)
    })

    it('still reuses a run that is genuinely in flight', async () => {
      const liveRun = { ...staleRun, leaseUntil: new Date(Date.now() + 600_000) }
      mocks.runFindFirst.mockImplementation(async ({ where }) =>
        matchesRunQuery(liveRun, where) ? liveRun : null)

      const result = await requestOutcomeRun({
        projectId: 'project-1', outcomeId: 'outcome-1', userId: 'user-1',
        source: 'WATCH', idempotencyKey: 'watch:project-1:tick',
      })

      // Reusing a live run is the whole point of the active check.
      expect(result).toEqual({
        runId: 'run-stale', auditId: 'audit-stale', outcomeIds: ['outcome-1'], reused: true,
      })
      expect(mocks.createAudit).not.toHaveBeenCalled()
    })

    it('excludes an expired lease in the query, not only in a read-time check', async () => {
      mocks.runFindFirst.mockResolvedValue(null)
      mocks.createAudit.mockResolvedValue({ auditId: 'audit-new', reused: false })

      await requestOutcomeRun({
        projectId: 'project-1', outcomeId: 'outcome-1', userId: 'user-1',
        source: 'WATCH', idempotencyKey: 'watch:project-1:tick',
      })

      const where = mocks.runFindFirst.mock.calls[0]?.[0]?.where
      // The database is the authority, so the lease belongs in the query rather
      // than only in a read-time check.
      expect(where).toMatchObject({
        status: { in: ['QUEUED', 'RUNNING'] },
        leaseUntil: { gt: expect.any(Date) },
      })
    })

    it('takes a lease when the run is created and releases it when the run ends', async () => {
      mocks.runFindFirst.mockResolvedValue(null)
      mocks.createAudit.mockResolvedValue({ auditId: 'audit-new', reused: false })

      await requestOutcomeRun({
        projectId: 'project-1', outcomeId: 'outcome-1', userId: 'user-1',
        source: 'WATCH', idempotencyKey: 'watch:project-1:lease',
      })

      // A run that never reaches a worker must still expire rather than block.
      expect(mocks.runCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ leaseUntil: expect.any(Date) }),
      }))
    })
  })

  describe('reclaiming a run no worker still owns', () => {
    // Excluding a stranded run from the active check is not sufficient on its
    // own. The partial unique index is
    //   run_requests(projectId) WHERE status IN ('QUEUED','RUNNING')
    // and a partial index predicate cannot call now(), so the database keeps
    // treating the abandoned run as active and rejects the replacement insert.
    // The filter alone would trade a stale result for a raw write error.

    it('fails an abandoned run so the partial unique index stops rejecting inserts', async () => {
      mocks.runFindMany.mockResolvedValue([{ id: 'run-stale', auditId: null }])

      await requestOutcomeRun({
        projectId: 'project-1', outcomeId: 'outcome-1', userId: 'user-1',
        source: 'WATCH', idempotencyKey: 'watch:project-1:reclaim',
      })

      expect(mocks.runUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          id: 'run-stale',
          status: { in: ['QUEUED', 'RUNNING'] },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: expect.any(Date) } }],
        },
        data: expect.objectContaining({
          status: 'FAILED',
          errorCode: 'RUN_ABANDONED',
          leaseUntil: null,
        }),
      }))
      // The customer sees an honest reason rather than a stale report.
      expect(mocks.runUpdateMany.mock.calls[0]?.[0]?.data.errorMessage)
        .toMatch(/could not finish/i)
    })

    it('reclaims before deciding whether the Site is busy, not after', async () => {
      mocks.runFindMany.mockResolvedValue([{ id: 'run-stale', auditId: null }])

      await requestOutcomeRun({
        projectId: 'project-1', outcomeId: 'outcome-1', userId: 'user-1',
        source: 'WATCH', idempotencyKey: 'watch:project-1:order',
      })

      const reclaimedAt = mocks.runUpdateMany.mock.invocationCallOrder[0]
      const checkedAt = mocks.runFindFirst.mock.invocationCallOrder[0]
      expect(reclaimedAt).toBeLessThan(checkedAt)
    })

    it('does not clobber a run whose worker renewed after the reclaim read', async () => {
      const renewedRun = {
        id: 'run-stale',
        projectId: 'project-1',
        environment: 'production',
        selections: [{ outcomeId: 'outcome-1' }],
        auditId: 'audit-stale',
        status: 'RUNNING',
        leaseUntil: new Date(Date.now() + 600_000),
      }
      // The candidate read raced just before the worker renewed its lease.
      mocks.runFindMany.mockResolvedValue([{ id: 'run-stale', auditId: null }])
      mocks.runUpdateMany.mockImplementation(async ({ where }) => {
        expect(where).toMatchObject({
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: expect.any(Date) } }],
        })
        return { count: 0 }
      })
      mocks.runFindFirst.mockResolvedValue(renewedRun)

      const result = await requestOutcomeRun({
        projectId: 'project-1', outcomeId: 'outcome-1', userId: 'user-1',
        source: 'WATCH', idempotencyKey: 'watch:project-1:renewed',
      })

      expect(result).toEqual({
        runId: 'run-stale',
        auditId: 'audit-stale',
        outcomeIds: ['outcome-1'],
        reused: true,
      })
      expect(mocks.createAudit).not.toHaveBeenCalled()
    })

    it('keeps a run whose audit already finished, so a real result is not thrown away', async () => {
      // The worker may have died after verifying but before recording it. The
      // assessments exist, so the run is reconciled rather than failed.
      mocks.auditFindUnique.mockResolvedValue({ status: 'COMPLETED' })
      mocks.runFindMany.mockResolvedValueOnce([{ id: 'run-stale', auditId: 'audit-done' }])
      mocks.runFindMany.mockResolvedValue([])

      await requestOutcomeRun({
        projectId: 'project-1', outcomeId: 'outcome-1', userId: 'user-1',
        source: 'WATCH', idempotencyKey: 'watch:project-1:completed',
      })

      // The completed audit is reconciled, which is what recovers the result.
      expect(mocks.runFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ auditId: 'audit-done' }),
      }))
      // And the run is not mislabelled as abandoned.
      expect(mocks.runUpdateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ errorCode: 'RUN_ABANDONED' }),
        })
      )
    })

    it('never touches a run that still holds a live lease', async () => {
      mocks.runFindMany.mockResolvedValue([])

      await requestOutcomeRun({
        projectId: 'project-1', outcomeId: 'outcome-1', userId: 'user-1',
        source: 'WATCH', idempotencyKey: 'watch:project-1:live',
      })

      const where = mocks.runFindMany.mock.calls[0]?.[0]?.where
      // The reclaim query is the exact inverse of the active check: it looks for
      // runs with no live lease, and nothing else.
      expect(where).toMatchObject({
        status: { in: ['QUEUED', 'RUNNING'] },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: expect.any(Date) } }],
      })
    })
  })
})
