import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  workerClose: vi.fn(), queueClose: vi.fn(), workerQuit: vi.fn(), producerQuit: vi.fn(), add: vi.fn(),
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
  mocks.add.mockResolvedValue(undefined)
})

describe('uptime queue shutdown', () => {
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
