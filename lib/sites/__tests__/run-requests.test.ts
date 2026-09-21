import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  outcomeFindFirst: vi.fn(),
  runFindUnique: vi.fn(),
  runFindFirst: vi.fn(),
  runCreate: vi.fn(),
  runUpdate: vi.fn(),
  runCount: vi.fn(),
  auditFindFirst: vi.fn(),
  createAudit: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    siteOutcome: { findFirst: mocks.outcomeFindFirst },
    runRequest: {
      findUnique: mocks.runFindUnique,
      findFirst: mocks.runFindFirst,
      create: mocks.runCreate,
      update: mocks.runUpdate,
      count: mocks.runCount,
    },
    audit: { findFirst: mocks.auditFindFirst },
  },
}))
vi.mock('@/lib/audit/create-audit', () => ({
  createAndEnqueueAudit: mocks.createAudit,
}))
vi.mock('@/lib/analytics/site-events', () => ({
  recordSiteLifecycleEvent: vi.fn().mockResolvedValue({}),
}))

import { requestOutcomeRun } from '@/lib/sites/application/run-requests'

const ownedOutcome = {
  id: 'outcome-1',
  kind: 'CHECKOUT',
  projectId: 'project-1',
  project: { url: 'https://shop.example/' },
  bindings: [{ config: { startUrl: 'https://shop.example/products/widget' } }],
}

describe('RunRequest tenant boundary and idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.outcomeFindFirst.mockResolvedValue(ownedOutcome)
    mocks.runFindUnique.mockResolvedValue(null)
    mocks.runFindFirst.mockResolvedValue(null)
    mocks.runCreate.mockResolvedValue({ id: 'run-1' })
    mocks.auditFindFirst.mockResolvedValue({ id: 'audit-parent' })
    mocks.createAudit.mockResolvedValue({ auditId: 'audit-1', reused: false })
    mocks.runUpdate.mockResolvedValue({})
    mocks.runCount.mockResolvedValue(0)
  })

  it('checks the Outcome, Project, and authenticated owner in one query', async () => {
    await requestOutcomeRun({
      projectId: 'project-1',
      outcomeId: 'outcome-1',
      userId: 'user-1',
      source: 'MCP',
      idempotencyKey: 'mcp:checkout:one',
    })

    expect(mocks.outcomeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'outcome-1',
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
    mocks.outcomeFindFirst.mockResolvedValue(null)
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

  it('reuses the same tenant-scoped idempotency key without enqueueing twice', async () => {
    mocks.runFindUnique.mockResolvedValue({
      id: 'run-existing',
      projectId: 'project-1',
      outcomeId: 'outcome-1',
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
      reused: true,
    })
    expect(mocks.runCreate).not.toHaveBeenCalled()
    expect(mocks.runCount).not.toHaveBeenCalled()
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
})
