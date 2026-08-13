import { describe, it, vi, beforeEach, afterEach } from 'vitest'
import assert from 'node:assert/strict'

const mocks = vi.hoisted(() => ({
  auditFindMany: vi.fn(),
  auditUpdate: vi.fn(),
  queueAdd: vi.fn(),
  queueGetJob: vi.fn(),
  jobGetState: vi.fn(),
  jobMoveToFailed: vi.fn(),
  jobRemove: vi.fn(),
  readWorkerHeartbeat: vi.fn(),
  logPipelineEvent: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    audit: {
      findMany: mocks.auditFindMany,
      update: mocks.auditUpdate,
    },
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

import {
  isAuditPastDeadline,
  isWorkerDownGiveUp,
  isQueuedPastDeadline,
  recoverAuditJobOnPoll,
  recoverStuckAuditOnCron,
  runStuckAuditRecoverySweep,
  WORKER_DEAD_RECOVERY_SECONDS,
} from '../recover-audit-job'

const HOUR = 60 * 60 * 1000

function makeJob(state: string | null): Record<string, unknown> {
  mocks.jobGetState.mockResolvedValue(state)
  mocks.jobMoveToFailed.mockResolvedValue(undefined)
  mocks.jobRemove.mockResolvedValue(undefined)
  const job = {
    getState: mocks.jobGetState,
    moveToFailed: mocks.jobMoveToFailed,
    remove: mocks.jobRemove,
  }
  mocks.queueGetJob.mockResolvedValue(job)
  return job
}

function resetMocks(): void {
  for (const fn of Object.values(mocks)) {
    fn.mockReset()
  }
  mocks.queueAdd.mockResolvedValue(undefined)
  mocks.queueGetJob.mockResolvedValue(null)
  mocks.readWorkerHeartbeat.mockResolvedValue({ alive: true })
  mocks.logPipelineEvent.mockResolvedValue(undefined)
  mocks.auditFindMany.mockResolvedValue([])
  mocks.auditUpdate.mockResolvedValue({})
}

describe('deadline helpers', () => {
  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('isAuditPastDeadline handles missing and recent startedAt', () => {
    assert.equal(isAuditPastDeadline(null), false)
    assert.equal(isAuditPastDeadline(undefined), false)
    assert.equal(isAuditPastDeadline(new Date(Date.now() - 1000)), false)
    assert.equal(isAuditPastDeadline(new Date(Date.now() - 2 * HOUR)), true)
  })

  it('isWorkerDownGiveUp respects the 180s bound', () => {
    assert.equal(isWorkerDownGiveUp(null), false)
    assert.equal(isWorkerDownGiveUp(new Date(Date.now() - 60_000)), false)
    assert.equal(isWorkerDownGiveUp(new Date(Date.now() - 181_000)), true)
  })

  it('isQueuedPastDeadline only flags old QUEUED audits without startedAt', () => {
    const old = new Date(Date.now() - 2 * HOUR)
    assert.equal(isQueuedPastDeadline('CHECKING', null, old), false)
    assert.equal(isQueuedPastDeadline('QUEUED', new Date(), old), false)
    assert.equal(isQueuedPastDeadline('QUEUED', null, new Date()), false)
    assert.equal(isQueuedPastDeadline('QUEUED', null, old), true)
  })
})

describe('recoverAuditJobOnPoll', () => {
  const audit = {
    status: 'CHECKING',
    updatedAt: new Date(),
    startedAt: new Date(),
    createdAt: new Date(),
  }

  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('returns noop for terminal audits', async () => {
    assert.equal(await recoverAuditJobOnPoll('a1', { ...audit, status: 'COMPLETED' }), 'noop')
    assert.equal(await recoverAuditJobOnPoll('a1', { ...audit, status: 'FAILED' }), 'noop')
  })

  it('force-fails past the hard deadline and kills an active job', async () => {
    makeJob('active')
    const result = await recoverAuditJobOnPoll('a1', {
      ...audit,
      startedAt: new Date(Date.now() - 2 * HOUR),
    })
    assert.equal(result, 'force_failed')
    expect(mocks.jobMoveToFailed).toHaveBeenCalled()
    const update = mocks.auditUpdate.mock.calls[0][0]
    expect(update.data.failureCode).toBe('AUDIT_HARD_DEADLINE')
    expect(update.data.status).toBe('FAILED')
  })

  it('force-fails past the deadline even without a job', async () => {
    const result = await recoverAuditJobOnPoll('a1', {
      ...audit,
      startedAt: new Date(Date.now() - 2 * HOUR),
    })
    assert.equal(result, 'force_failed')
    expect(mocks.jobMoveToFailed).not.toHaveBeenCalled()
  })

  it('gives up and fails when the worker is down past the give-up window', async () => {
    mocks.readWorkerHeartbeat.mockResolvedValue({ alive: false })
    makeJob('active')
    const result = await recoverAuditJobOnPoll('a1', {
      ...audit,
      createdAt: new Date(Date.now() - 200_000),
    })
    assert.equal(result, 'force_failed')
    expect(mocks.jobMoveToFailed).toHaveBeenCalled()
  })

  it('keeps polling (noop) when the worker is down but not past give-up', async () => {
    mocks.readWorkerHeartbeat.mockResolvedValue({ alive: false })
    makeJob('active')
    const result = await recoverAuditJobOnPoll('a1', audit)
    assert.equal(result, 'noop')
  })

  it('requeues a QUEUED audit past deadline with no job', async () => {
    const result = await recoverAuditJobOnPoll('a1', {
      status: 'QUEUED',
      updatedAt: new Date(Date.now() - 2 * HOUR),
      startedAt: null,
      createdAt: new Date(),
    })
    assert.equal(result, 'requeued')
    expect(mocks.queueAdd).toHaveBeenCalledWith(
      'audit',
      { auditId: 'a1' },
      { jobId: 'a1', attempts: 1, removeOnComplete: 100, removeOnFail: 500 }
    )
  })

  it('requeues when the waiting job is stale past deadline', async () => {
    makeJob('waiting')
    const result = await recoverAuditJobOnPoll('a1', {
      status: 'QUEUED',
      updatedAt: new Date(Date.now() - 2 * HOUR),
      startedAt: null,
      createdAt: new Date(),
    })
    assert.equal(result, 'requeued')
    expect(mocks.jobRemove).toHaveBeenCalled()
  })

  it('force-fails a QUEUED audit past deadline with an active job', async () => {
    makeJob('active')
    const result = await recoverAuditJobOnPoll('a1', {
      status: 'QUEUED',
      updatedAt: new Date(Date.now() - 2 * HOUR),
      startedAt: null,
      createdAt: new Date(),
    })
    assert.equal(result, 'force_failed')
  })

  it('requeues a QUEUED audit with no job and no startedAt', async () => {
    const result = await recoverAuditJobOnPoll('a1', {
      status: 'QUEUED',
      updatedAt: new Date(),
      startedAt: null,
      createdAt: new Date(),
    })
    assert.equal(result, 'requeued')
  })

  it('force-fails a lost job that never started', async () => {
    const result = await recoverAuditJobOnPoll('a1', {
      status: 'CHECKING',
      updatedAt: new Date(),
      startedAt: new Date(),
      createdAt: new Date(),
    })
    assert.equal(result, 'force_failed')
    expect(mocks.auditUpdate.mock.calls[0][0].data.failureCode).toBe('AUDIT_JOB_LOST')
  })

  it('returns noop within the worker-dead recovery window', async () => {
    mocks.readWorkerHeartbeat.mockResolvedValue({ alive: false })
    makeJob('active')
    const result = await recoverAuditJobOnPoll('a1', audit)
    assert.equal(result, 'noop')
  })

  it('returns noop when the worker heartbeat is alive', async () => {
    makeJob('active')
    const result = await recoverAuditJobOnPoll('a1', {
      ...audit,
      updatedAt: new Date(Date.now() - (WORKER_DEAD_RECOVERY_SECONDS + 10) * 1000),
    })
    assert.equal(result, 'noop')
  })

  it('requeues a waiting job when the worker is dead', async () => {
    mocks.readWorkerHeartbeat.mockResolvedValue({ alive: false })
    makeJob('waiting')
    const result = await recoverAuditJobOnPoll('a1', {
      ...audit,
      updatedAt: new Date(Date.now() - (WORKER_DEAD_RECOVERY_SECONDS + 10) * 1000),
    })
    assert.equal(result, 'requeued')
  })

  it('fails an active job when the worker is dead', async () => {
    mocks.readWorkerHeartbeat.mockResolvedValue({ alive: false })
    makeJob('active')
    const result = await recoverAuditJobOnPoll('a1', {
      ...audit,
      updatedAt: new Date(Date.now() - (WORKER_DEAD_RECOVERY_SECONDS + 10) * 1000),
    })
    assert.equal(result, 'force_failed')
    expect(mocks.jobMoveToFailed).toHaveBeenCalled()
  })
})

describe('recoverStuckAuditOnCron', () => {
  const audit = { status: 'CHECKING', startedAt: new Date() }

  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('returns noop for terminal audits', async () => {
    assert.equal(await recoverStuckAuditOnCron('a1', { ...audit, status: 'COMPLETED' }), 'noop')
    assert.equal(await recoverStuckAuditOnCron('a1', { ...audit, status: 'FAILED' }), 'noop')
  })

  it('force-fails when past the deadline with an active job', async () => {
    makeJob('active')
    const result = await recoverStuckAuditOnCron('a1', {
      ...audit,
      startedAt: new Date(Date.now() - 2 * HOUR),
    })
    assert.equal(result, 'force_failed')
    expect(mocks.jobMoveToFailed).toHaveBeenCalled()
  })

  it('requeues a stuck QUEUED audit', async () => {
    makeJob('failed')
    const result = await recoverStuckAuditOnCron('a1', { status: 'QUEUED', startedAt: null })
    assert.equal(result, 'requeued')
    expect(mocks.queueAdd).toHaveBeenCalled()
  })

  it('removes a waiting job before requeuing', async () => {
    makeJob('waiting')
    const result = await recoverStuckAuditOnCron('a1', { status: 'QUEUED', startedAt: null })
    assert.equal(result, 'requeued')
    expect(mocks.jobRemove).toHaveBeenCalled()
  })

  it('force-fails a stuck non-QUEUED audit', async () => {
    makeJob('failed')
    const result = await recoverStuckAuditOnCron('a1', audit)
    assert.equal(result, 'force_failed')
  })
})

describe('runStuckAuditRecoverySweep', () => {
  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('reports counts across recovered audits', async () => {
    mocks.auditFindMany.mockResolvedValue([
      { id: 'a1', status: 'QUEUED', startedAt: null },
      { id: 'a2', status: 'CHECKING', startedAt: new Date() },
    ])
    const result = await runStuckAuditRecoverySweep()
    assert.deepEqual(result, { requeued: 1, failed: 1, checked: 2 })
  })

  it('returns empty when nothing is stuck', async () => {
    const result = await runStuckAuditRecoverySweep()
    assert.deepEqual(result, { requeued: 0, failed: 0, checked: 0 })
  })

  it('retries the query once before giving up', async () => {
    mocks.auditFindMany
      .mockRejectedValueOnce(new Error('db hiccup'))
      .mockResolvedValueOnce([])
    const result = await runStuckAuditRecoverySweep()
    assert.deepEqual(result, { requeued: 0, failed: 0, checked: 0 })
    expect(mocks.auditFindMany).toHaveBeenCalledTimes(2)
  })
})

import { expect } from 'vitest'
void expect
