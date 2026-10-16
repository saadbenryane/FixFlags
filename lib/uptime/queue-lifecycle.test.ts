import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  workerClose: vi.fn(), queueClose: vi.fn(), workerQuit: vi.fn(), producerQuit: vi.fn(), add: vi.fn(),
  getState: vi.fn(), retry: vi.fn(),
}))
vi.mock('bullmq', () => ({
  Worker: class {
    close = mocks.workerClose
    on = vi.fn()
  },
  Queue: class {
    close = mocks.queueClose
    add = mocks.add
    on = vi.fn()
  },
}))
vi.mock('@/lib/queue/redis', () => ({
  createWorkerRedis: () => ({ quit: mocks.workerQuit }),
  createQueueRedis: () => ({ quit: mocks.producerQuit }),
}))
import { enqueueUptimeProbe, startUptimeWorker } from './queue'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.workerClose.mockResolvedValue(undefined)
  mocks.queueClose.mockResolvedValue(undefined)
  mocks.workerQuit.mockResolvedValue(undefined)
  mocks.producerQuit.mockResolvedValue(undefined)
  mocks.getState.mockResolvedValue('waiting')
  mocks.retry.mockResolvedValue(undefined)
  mocks.add.mockResolvedValue({ getState: mocks.getState, retry: mocks.retry })
})

describe('uptime queue lifecycle', () => {
  it('keeps a retained confirmation deferred until its original due time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const now = new Date('2026-10-15T12:00:00Z')
    vi.setSystemTime(now)
    const worker = startUptimeWorker(async () => {})
    try {
      const confirmation = { monitorId: 'monitor_1', version: 1, scheduledAt: now.toISOString(), attempt: 2 as const }
      const dueAt = new Date(now.getTime() + 30_000)
      mocks.getState.mockResolvedValue('failed')
      await enqueueUptimeProbe(confirmation, dueAt)
      expect(mocks.retry).not.toHaveBeenCalled()
      vi.setSystemTime(dueAt)
      await enqueueUptimeProbe(confirmation, dueAt)
      expect(mocks.retry).toHaveBeenCalledWith('failed', { resetAttemptsMade: true, resetAttemptsStarted: true })
    } finally { await worker.close(); vi.useRealTimers() }
  })

  it('stops worker intake immediately and keeps dispatch available until maintenance drains', async () => {
    const worker = startUptimeWorker(async () => {})
    let finishMaintenance!: () => void
    const pendingMaintenance = new Promise<void>(resolve => { finishMaintenance = resolve })
    const closing = worker.close(pendingMaintenance)
    try {
      expect(mocks.workerClose).toHaveBeenCalledOnce()
      await Promise.resolve()
      expect(mocks.workerQuit).not.toHaveBeenCalled()
      expect(mocks.queueClose).not.toHaveBeenCalled()
      const scheduledAt = new Date().toISOString()
      await enqueueUptimeProbe({ monitorId: 'monitor_1', version: 1, scheduledAt, attempt: 1 }, new Date())
      expect(mocks.add).toHaveBeenCalledOnce()
      expect(mocks.producerQuit).not.toHaveBeenCalled()
    } finally {
      finishMaintenance()
      await closing
    }
    expect(mocks.queueClose).toHaveBeenCalledOnce()
    expect(mocks.workerQuit).toHaveBeenCalledOnce()
    expect(mocks.producerQuit).toHaveBeenCalledOnce()
  })
})
