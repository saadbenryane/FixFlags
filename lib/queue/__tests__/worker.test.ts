import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuditDeadlineError,
  BrowserLaunchError,
  StorageNotConfiguredError,
  StorageUploadError,
} from '@/lib/audit/pipeline-errors'

const mocks = vi.hoisted(() => {
  class UnrecoverableError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'UnrecoverableError'
    }
  }
  return {
    UnrecoverableError,
    capturedListeners: {} as Record<string, Function>,
    runAudit: vi.fn(),
    runAiReview: vi.fn(),
    runRepoScan: vi.fn(),
    runFixPr: vi.fn(),
    createWorkerRedis: vi.fn(() => ({})),
    touchWorkerHeartbeat: vi.fn().mockResolvedValue(undefined),
    recordStalledJob: vi.fn().mockResolvedValue(undefined),
    getBrowserDiagnostics: vi.fn(() => ({
      connected: true,
      activeContexts: 0,
    })),
    WORKER_CONCURRENCY: 2,
    AUDIT_DEADLINE_MS: 300_000,
    logger: { info: vi.fn(), error: vi.fn() },
  }
})

const UnrecoverableError = mocks.UnrecoverableError

vi.mock('@/lib/audit/runner', () => ({ runAudit: mocks.runAudit }))
vi.mock('@/lib/audit/run-ai-review', () => ({ runAiReview: mocks.runAiReview }))
vi.mock('@/lib/repo-scan/runner', () => ({ runRepoScan: mocks.runRepoScan }))
vi.mock('@/lib/repo-scan/fix-pr-runner', () => ({ runFixPr: mocks.runFixPr }))
vi.mock('@/lib/queue/redis', () => ({ createWorkerRedis: mocks.createWorkerRedis }))
vi.mock('@/lib/queue/worker-heartbeat', () => ({
  touchWorkerHeartbeat: mocks.touchWorkerHeartbeat,
  recordStalledJob: mocks.recordStalledJob,
}))
vi.mock('@/lib/audit/pipeline-config', () => ({
  AUDIT_DEADLINE_MS: mocks.AUDIT_DEADLINE_MS,
}))
vi.mock('@/lib/logger', () => ({ logger: mocks.logger }))
vi.mock('@/lib/queue/estimate', () => ({
  WORKER_CONCURRENCY: mocks.WORKER_CONCURRENCY,
}))
vi.mock('@/lib/audit/screenshot', () => ({
  getBrowserDiagnostics: mocks.getBrowserDiagnostics,
}))

const prismaMocks = vi.hoisted(() => ({
  auditFindUnique: vi.fn(),
  auditUpdate: vi.fn(),
  auditUpdateMany: vi.fn(),
  repoScanUpdateMany: vi.fn(),
  repoFixPrUpdateMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    audit: {
      findUnique: prismaMocks.auditFindUnique,
      update: prismaMocks.auditUpdate,
      updateMany: prismaMocks.auditUpdateMany,
    },
    repoScan: { updateMany: prismaMocks.repoScanUpdateMany },
    repoFixPr: { updateMany: prismaMocks.repoFixPrUpdateMany },
  },
}))

let capturedProcessor: ((job: any) => Promise<any>) | undefined
let lastWorkerOpts: any

vi.mock('bullmq', () => {
  class FakeWorker {
    constructor(_name: string, processor: any, opts: any) {
      capturedProcessor = processor
      lastWorkerOpts = opts
    }
    on(event: string, handler: Function) {
      mocks.capturedListeners[event] = handler
      return this
    }
  }
  return { Worker: FakeWorker, UnrecoverableError: mocks.UnrecoverableError }
})

function makeJob(overrides: Partial<{
  name: string
  data: Record<string, unknown>
  id: string | number
  attemptsMade: number
  opts: { attempts?: number }
}> = {}) {
  return {
    id: 'job-1',
    name: 'audit',
    data: { auditId: 'audit-abc' },
    attemptsMade: 1,
    opts: { attempts: 3 },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  capturedProcessor = undefined
  lastWorkerOpts = undefined
  for (const key of Object.keys(mocks.capturedListeners)) {
    delete mocks.capturedListeners[key]
  }
})

describe('wrapAuditJobError', () => {
  it('wraps non-retryable audit deadline error as UnrecoverableError', async () => {
    const { wrapAuditJobError } = await import('@/lib/queue/worker')
    const error = new AuditDeadlineError('judging')
    const result = wrapAuditJobError(error)

    expect(result).toBeInstanceOf(UnrecoverableError)
    expect(result.message).toBe('Audit timed out during judging')
  })

  it('wraps non-retryable browser launch error as UnrecoverableError', async () => {
    const { wrapAuditJobError } = await import('@/lib/queue/worker')
    const result = wrapAuditJobError(new BrowserLaunchError('chromium missing'))

    expect(result).toBeInstanceOf(UnrecoverableError)
    expect(result.message).toBe('chromium missing')
  })

  it('wraps non-retryable storage not configured error as UnrecoverableError', async () => {
    const { wrapAuditJobError } = await import('@/lib/queue/worker')
    const result = wrapAuditJobError(new StorageNotConfiguredError('no r2 bucket'))

    expect(result).toBeInstanceOf(UnrecoverableError)
  })

  it('wraps non-retryable storage upload error as UnrecoverableError', async () => {
    const { wrapAuditJobError } = await import('@/lib/queue/worker')
    const result = wrapAuditJobError(new StorageUploadError('upload failed'))

    expect(result).toBeInstanceOf(UnrecoverableError)
  })

  it('wraps error with Desktop screenshot capture failed as UnrecoverableError', async () => {
    const { wrapAuditJobError } = await import('@/lib/queue/worker')
    const result = wrapAuditJobError(new Error('Desktop screenshot capture failed'))

    expect(result).toBeInstanceOf(UnrecoverableError)
  })

  it('wraps error mentioning ANTHROPIC_API_KEY as UnrecoverableError', async () => {
    const { wrapAuditJobError } = await import('@/lib/queue/worker')
    const result = wrapAuditJobError(new Error('missing ANTHROPIC_API_KEY'))

    expect(result).toBeInstanceOf(UnrecoverableError)
  })

  it('wraps error mentioning OPENAI_API_KEY as UnrecoverableError', async () => {
    const { wrapAuditJobError } = await import('@/lib/queue/worker')
    const result = wrapAuditJobError(new Error('OPENAI_API_KEY not set'))

    expect(result).toBeInstanceOf(UnrecoverableError)
  })

  it('returns the same Error instance for retryable errors', async () => {
    const { wrapAuditJobError } = await import('@/lib/queue/worker')
    const error = new Error('network timeout')
    const result = wrapAuditJobError(error)

    expect(result).toBe(error)
    expect(result).not.toBeInstanceOf(UnrecoverableError)
  })

  it('wraps unknown non-Error values as plain Error', async () => {
    const { wrapAuditJobError } = await import('@/lib/queue/worker')
    const result = wrapAuditJobError('string failure')

    expect(result).toBeInstanceOf(Error)
    expect(result).not.toBeInstanceOf(UnrecoverableError)
    expect(result.message).toBe('string failure')
  })

  it('wraps null as Error', async () => {
    const { wrapAuditJobError } = await import('@/lib/queue/worker')
    const result = wrapAuditJobError(null)

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('null')
  })

  it('wraps undefined as Error', async () => {
    const { wrapAuditJobError } = await import('@/lib/queue/worker')
    const result = wrapAuditJobError(undefined)

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('undefined')
  })

  it('wraps numeric values as Error', async () => {
    const { wrapAuditJobError } = await import('@/lib/queue/worker')
    const result = wrapAuditJobError(42)

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('42')
  })
})

describe('startWorker', () => {
  it('creates a BullMQ Worker with correct configuration', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()

    expect(lastWorkerOpts).toMatchObject({
      concurrency: 2,
      maxStalledCount: 0,
    })
    expect(mocks.capturedListeners['completed']).toBeTypeOf('function')
    expect(mocks.capturedListeners['failed']).toBeTypeOf('function')
    expect(mocks.capturedListeners['stalled']).toBeTypeOf('function')
  })

  it('touches heartbeat on initial start', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    expect(mocks.touchWorkerHeartbeat).toHaveBeenCalledWith({
      browserOk: true,
      activeBrowserContexts: 0,
    })
  })

  it('routes audit jobs to runAudit', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    mocks.runAudit.mockResolvedValue(undefined)
    prismaMocks.auditFindUnique.mockResolvedValue({ status: 'COMPLETED' })

    await capturedProcessor!(makeJob({ name: 'audit', data: { auditId: 'a1' } }))

    expect(mocks.runAudit).toHaveBeenCalledWith('a1')
  })

  it('routes ai-review jobs to runAiReview', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    mocks.runAiReview.mockResolvedValue(undefined)

    await capturedProcessor!(makeJob({ name: 'ai-review', data: { auditId: 'a2' } }))

    expect(mocks.runAiReview).toHaveBeenCalledWith('a2')
    expect(mocks.runAudit).not.toHaveBeenCalled()
  })

  it('routes repo-scan jobs to runRepoScan', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    mocks.runRepoScan.mockResolvedValue(undefined)

    await capturedProcessor!(makeJob({ name: 'repo-scan', data: { repoScanId: 'rs1' } }))

    expect(mocks.runRepoScan).toHaveBeenCalledWith('rs1')
  })

  it('routes repo-fix-pr jobs to runFixPr', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    mocks.runFixPr.mockResolvedValue(undefined)

    await capturedProcessor!(makeJob({ name: 'repo-fix-pr', data: { repoFixPrId: 'fp1' } }))

    expect(mocks.runFixPr).toHaveBeenCalledWith('fp1')
  })

  it('touches heartbeat before processing each job', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    mocks.runAudit.mockResolvedValue(undefined)
    prismaMocks.auditFindUnique.mockResolvedValue({ status: 'COMPLETED' })

    mocks.touchWorkerHeartbeat.mockClear()

    await capturedProcessor!(makeJob())

    expect(mocks.touchWorkerHeartbeat).toHaveBeenCalled()
  })
})

describe('non-terminal audit state detection', () => {
  it('marks audit as FAILED and throws UnrecoverableError when status is non-terminal', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    mocks.runAudit.mockResolvedValue(undefined)
    prismaMocks.auditFindUnique.mockResolvedValue({ status: 'CHECKING' })
    prismaMocks.auditUpdate.mockResolvedValue(undefined)

    await expect(
      capturedProcessor!(makeJob({ data: { auditId: 'a3' } }))
    ).rejects.toThrow(UnrecoverableError)

    expect(prismaMocks.auditUpdate).toHaveBeenCalledWith({
      where: { id: 'a3' },
      data: expect.objectContaining({
        status: 'FAILED',
        failureCode: 'AUDIT_JOB_NON_TERMINAL',
      }),
    })
  })

  it('does not mark FAILED when audit reaches COMPLETED', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    mocks.runAudit.mockResolvedValue(undefined)
    prismaMocks.auditFindUnique.mockResolvedValue({ status: 'COMPLETED' })

    await capturedProcessor!(makeJob({ data: { auditId: 'a4' } }))

    expect(prismaMocks.auditUpdate).not.toHaveBeenCalled()
  })

  it('does not mark FAILED when audit reaches FAILED', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    mocks.runAudit.mockResolvedValue(undefined)
    prismaMocks.auditFindUnique.mockResolvedValue({ status: 'FAILED' })

    await capturedProcessor!(makeJob({ data: { auditId: 'a5' } }))

    expect(prismaMocks.auditUpdate).not.toHaveBeenCalled()
  })
})

describe('error wrapping in processor', () => {
  it('wraps retryable audit errors as plain Error', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    mocks.runAudit.mockRejectedValue(new Error('ECONNRESET'))

    await expect(capturedProcessor!(makeJob())).rejects.toThrow('ECONNRESET')
  })

  it('wraps non-retryable audit errors as UnrecoverableError', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    mocks.runAudit.mockRejectedValue(new AuditDeadlineError('capturing'))

    await expect(capturedProcessor!(makeJob())).rejects.toThrow(UnrecoverableError)
  })

  it('wraps unknown throw values as Error', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    mocks.runAudit.mockRejectedValue('raw string')

    await expect(capturedProcessor!(makeJob())).rejects.toThrow('raw string')
  })
})

describe('failed event handler', () => {
  it('updates repoScan to FAILED on repo-scan job failure', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    prismaMocks.repoScanUpdateMany.mockResolvedValue({ count: 1 })

    await mocks.capturedListeners['failed'](
      makeJob({ name: 'repo-scan', data: { repoScanId: 'rs2' } }),
      new Error('scan crashed')
    )

    expect(prismaMocks.repoScanUpdateMany).toHaveBeenCalledWith({
      where: { id: 'rs2', status: { notIn: ['COMPLETED', 'FAILED'] } },
      data: { status: 'FAILED', errorMsg: 'scan crashed', completedAt: expect.any(Date) },
    })
  })

  it('updates repoFixPr to FAILED on repo-fix-pr job failure', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    prismaMocks.repoFixPrUpdateMany.mockResolvedValue({ count: 1 })

    await mocks.capturedListeners['failed'](
      makeJob({ name: 'repo-fix-pr', data: { repoFixPrId: 'fp2' } }),
      new Error('pr failed')
    )

    expect(prismaMocks.repoFixPrUpdateMany).toHaveBeenCalledWith({
      where: { id: 'fp2', status: { not: 'CREATED' } },
      data: { status: 'FAILED', errorMsg: 'pr failed' },
    })
  })

  it('skips FAILED audit update when audit is already terminal', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    prismaMocks.auditFindUnique.mockResolvedValue({ status: 'COMPLETED' })

    await mocks.capturedListeners['failed'](
      makeJob({ data: { auditId: 'a6' } }),
      new Error('late failure')
    )

    expect(prismaMocks.auditUpdateMany).not.toHaveBeenCalled()
  })

  it('skips FAILED audit update when audit is already FAILED', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    prismaMocks.auditFindUnique.mockResolvedValue({ status: 'FAILED' })

    await mocks.capturedListeners['failed'](
      makeJob({ data: { auditId: 'a7' } }),
      new Error('already failed')
    )

    expect(prismaMocks.auditUpdateMany).not.toHaveBeenCalled()
  })

  it('marks audit as FAILED after exhausting all retries', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    prismaMocks.auditFindUnique.mockResolvedValue({ status: 'CHECKING' })
    prismaMocks.auditUpdateMany.mockResolvedValue({ count: 1 })

    const job = makeJob({ data: { auditId: 'a8' }, opts: { attempts: 3 } })
    job.attemptsMade = 3

    await mocks.capturedListeners['failed'](job, new Error('final failure'))

    expect(prismaMocks.auditUpdateMany).toHaveBeenCalledWith({
      where: { id: 'a8', status: { notIn: ['COMPLETED', 'FAILED'] } },
      data: expect.objectContaining({
        status: 'FAILED',
        failureCode: 'AUDIT_JOB_FAILED',
        failureStage: 'worker',
      }),
    })
  })

  it('does not mark audit FAILED when retries remain', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    prismaMocks.auditFindUnique.mockResolvedValue({ status: 'CHECKING' })

    const job = makeJob({ data: { auditId: 'a9' }, opts: { attempts: 3 } })
    job.attemptsMade = 1

    await mocks.capturedListeners['failed'](job, new Error('transient'))

    expect(prismaMocks.auditUpdateMany).not.toHaveBeenCalled()
  })

  it('returns early when job is null', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()

    await mocks.capturedListeners['failed'](null, new Error('no job'))
    expect(mocks.logger.error).toHaveBeenCalled()
  })
})

describe('completed event handler', () => {
  it('logs job completion and touches heartbeat', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()
    mocks.touchWorkerHeartbeat.mockClear()

    await mocks.capturedListeners['completed'](
      makeJob({ data: { auditId: 'a10' } })
    )

    expect(mocks.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('completed'),
      expect.objectContaining({ auditId: 'a10' })
    )
    expect(mocks.touchWorkerHeartbeat).toHaveBeenCalled()
  })
})

describe('stalled event handler', () => {
  it('records stalled job metric and logs error', async () => {
    const { startWorker } = await import('@/lib/queue/worker')
    startWorker()

    await mocks.capturedListeners['stalled']('stalled-job-id')

    expect(mocks.recordStalledJob).toHaveBeenCalled()
    expect(mocks.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('stalled'),
    )
  })
})
