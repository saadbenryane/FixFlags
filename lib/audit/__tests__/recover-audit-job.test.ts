import { describe, it, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  auditFindMany: vi.fn(),
  auditUpdate: vi.fn(),
  auditUpdateMany: vi.fn(),
  auditFindUniqueOrThrow: vi.fn(),
  queryRaw: vi.fn(),
  projectionCandidates: vi.fn(),
  queueAdd: vi.fn(),
  queueGetJob: vi.fn(),
  jobGetState: vi.fn(),
  jobMoveToFailed: vi.fn(),
  jobRemove: vi.fn(),
  readWorkerHeartbeat: vi.fn(),
  logPipelineEvent: vi.fn(),
  persistImprovementCycle: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: mocks.projectionCandidates,
    audit: {
      findMany: mocks.auditFindMany,
      update: mocks.auditUpdate,
      updateMany: mocks.auditUpdateMany,
      findUniqueOrThrow: mocks.auditFindUniqueOrThrow,
    },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({ $queryRaw: mocks.queryRaw, audit: {
      update: mocks.auditUpdate, updateMany: mocks.auditUpdateMany, findUniqueOrThrow: mocks.auditFindUniqueOrThrow,
    } }),
  },
}))

vi.mock('@/lib/queue/client', () => ({
  getAuditQueue: () => ({
    add: mocks.queueAdd,
    getJob: mocks.queueGetJob,
  }),
}))

vi.mock('@/lib/queue/worker-heartbeat', () => ({
  readWorkerHeartbeat: mocks.readWorkerHeartbeat,
}))

vi.mock('@/lib/audit/pipeline-log', () => ({
  logPipelineEvent: mocks.logPipelineEvent,
}))

vi.mock('@/lib/audit/finalize', () => ({
  persistImprovementCycle: mocks.persistImprovementCycle,
}))

const retireLegacyExecution = vi.hoisted(() => vi.fn())
vi.mock('@/lib/audit/retire-legacy-execution', () => ({ retireLegacyExecution }))
import { recoverCompletedImprovementProjections, runStuckAuditRecoverySweep } from '../recover-audit-job'

function resetMocks(): void {
  for (const fn of Object.values(mocks)) {
    fn.mockReset()
  }
  mocks.queueAdd.mockResolvedValue(undefined)
  mocks.queueGetJob.mockResolvedValue(null)
  mocks.readWorkerHeartbeat.mockResolvedValue({ alive: true })
  mocks.logPipelineEvent.mockResolvedValue(undefined)
  mocks.persistImprovementCycle.mockResolvedValue(undefined)
  mocks.auditFindMany.mockResolvedValue([])
  mocks.auditUpdate.mockResolvedValue({})
  mocks.auditUpdateMany.mockResolvedValue({ count: 1 })
  mocks.auditFindUniqueOrThrow.mockResolvedValue({ executionGeneration: 1 })
  mocks.queryRaw.mockResolvedValue([{ id: 'execution', authorized: true }])
  mocks.projectionCandidates.mockResolvedValue([])
}

describe('legacy retirement sweep', () => {
  beforeEach(() => { resetMocks(); retireLegacyExecution.mockReset().mockResolvedValue(true) })
  it('retires unfinished legacy checks without re-enqueuing their external work', async () => {
    mocks.projectionCandidates.mockResolvedValue([{ id: 'queued' }, { id: 'started' }])
    expect(await runStuckAuditRecoverySweep()).toEqual({ requeued: 0, failed: 2, checked: 2 })
    expect(retireLegacyExecution).toHaveBeenNthCalledWith(1, 'queued', expect.any(Date))
    expect(retireLegacyExecution).toHaveBeenNthCalledWith(2, 'started', expect.any(Date))
    expect(mocks.queueAdd).not.toHaveBeenCalled()
  })
  it('continues after one interrupted retirement and leaves live leases alone', async () => {
    mocks.projectionCandidates.mockResolvedValue([{ id: 'interrupted' }, { id: 'owned' }, { id: 'other' }])
    retireLegacyExecution.mockRejectedValueOnce(new Error('interrupted')).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    expect(await runStuckAuditRecoverySweep()).toEqual({ requeued: 0, failed: 1, checked: 3 })
  })
  it('retries an interrupted discovery read', async () => {
    mocks.projectionCandidates.mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce([])
    expect(await runStuckAuditRecoverySweep()).toEqual({ requeued: 0, failed: 0, checked: 0 })
    expect(mocks.projectionCandidates).toHaveBeenCalledTimes(2)
  })
})

describe('recoverCompletedImprovementProjections', () => {
  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('retries a bounded batch through the canonical idempotent projector', async () => {
    mocks.projectionCandidates.mockResolvedValue([
      { id: 'completed-1', parentId: null, projectId: null },
      { id: 'completed-2', parentId: 'parent-1', projectId: null },
    ])

    const result = await recoverCompletedImprovementProjections()

    expect(mocks.projectionCandidates).toHaveBeenCalledWith(expect.any(Array), expect.any(Date), expect.anything(), expect.any(Date), 25)
    expect(mocks.persistImprovementCycle).toHaveBeenCalledWith('completed-1', null, { recoverLegacyUsage: true })
    expect(mocks.persistImprovementCycle).toHaveBeenCalledWith('completed-2', 'parent-1', { recoverLegacyUsage: true })
    expect(result).toEqual({ projected: 2, failed: 0, checked: 2 })
    expect(mocks.auditUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'completed-2', projectId: null, parentId: 'parent-1',
        status: 'COMPLETED', improvementProjectedAt: null }),
      data: expect.objectContaining({ executionGeneration: { increment: 1 }, executionToken: expect.any(String) }),
    }))
  })

  it('counts a failed projection and continues the batch', async () => {
    mocks.projectionCandidates.mockResolvedValue([
      { id: 'completed-1', parentId: null, projectId: null },
      { id: 'completed-2', parentId: null, projectId: null },
    ])
    mocks.persistImprovementCycle
      .mockRejectedValueOnce(new Error('fault after COMPLETED'))
      .mockResolvedValueOnce(undefined)

    await expect(recoverCompletedImprovementProjections()).resolves.toEqual({
      projected: 1,
      failed: 1,
      checked: 2,
    })
    expect(mocks.persistImprovementCycle).toHaveBeenCalledTimes(2)
  })
})

import { expect } from 'vitest'
void expect
