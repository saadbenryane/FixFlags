import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  workerClose: vi.fn(), queueClose: vi.fn(), workerDisconnect: vi.fn(), producerDisconnect: vi.fn(), add: vi.fn(),
  getState: vi.fn(), retry: vi.fn(), running: vi.fn(), workerPaused: vi.fn(), queuePaused: vi.fn(),
  command: { status: 'ready' }, blocking: { status: 'ready' },
}))
vi.mock('bullmq', () => ({
  ErrorCode: { JobNotInState: -3 },
  Worker: class {
    close = mocks.workerClose
    on = vi.fn()
    client = Promise.resolve(mocks.command)
    waitUntilReady = async () => mocks.blocking
    isRunning = mocks.running
    isPaused = mocks.workerPaused
  },
  Queue: class {
    close = mocks.queueClose
    add = mocks.add
    isPaused = mocks.queuePaused
    on = vi.fn()
    waitUntilReady = async () => {}
  },
}))
vi.mock('@/lib/queue/redis', () => ({
  createWorkerRedis: () => ({ status: 'ready', disconnect() { mocks.workerDisconnect(); this.status = 'end' } }),
  createQueueRedis: () => ({ status: 'ready', disconnect() { mocks.producerDisconnect(); this.status = 'end' } }),
}))
import { enqueueUptimeProbe, startUptimeWorker } from './queue'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.workerClose.mockResolvedValue(undefined)
  mocks.queueClose.mockResolvedValue(undefined)
  mocks.getState.mockResolvedValue('waiting')
  mocks.running.mockReturnValue(true)
  mocks.workerPaused.mockReturnValue(false)
  mocks.queuePaused.mockResolvedValue(false)
  mocks.command.status = 'ready'; mocks.blocking.status = 'ready'
  mocks.retry.mockResolvedValue(undefined)
  mocks.add.mockResolvedValue({ getState: mocks.getState, retry: mocks.retry })
})

describe('uptime queue lifecycle', () => {
  it('requires both connections, a running consumer and an unpaused queue', async () => {
    const worker = startUptimeWorker(async () => {})
    try {
      await worker.waitUntilReady()
      expect(await worker.checkReady()).toBe(true)
      mocks.command.status = 'reconnecting'
      expect(await worker.checkReady()).toBe(false)
      mocks.command.status = 'ready'
      mocks.blocking.status = 'reconnecting'
      expect(await worker.checkReady()).toBe(false)
      mocks.blocking.status = 'ready'
      mocks.workerPaused.mockReturnValueOnce(true)
      expect(await worker.checkReady()).toBe(false)
      mocks.running.mockReturnValueOnce(false)
      expect(await worker.checkReady()).toBe(false)
      mocks.queuePaused.mockResolvedValueOnce(true)
      expect(await worker.checkReady()).toBe(false)
      expect(await worker.checkReady()).toBe(true)
    } finally { await worker.close() }
  })

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

  it.each(['waiting', 'active', 'completed', 'failed', 'unknown'] as const)('rechecks a terminal retry conflict with current state %s', async current => {
    const worker = startUptimeWorker(async () => {})
    try {
      const conflict = Object.assign(new Error('Retained job moved'), { code: -3 })
      mocks.getState.mockResolvedValueOnce('failed').mockResolvedValueOnce(current)
      mocks.retry.mockRejectedValueOnce(conflict)
      const dueAt = new Date()
      const result = enqueueUptimeProbe({ monitorId: 'monitor_1', version: 1, scheduledAt: dueAt.toISOString(), attempt: 1 }, dueAt)
      if (current === 'unknown' || current === 'failed') await expect(result).rejects.toBe(conflict)
      else await expect(result).resolves.toBeUndefined()
      expect(mocks.getState).toHaveBeenCalledTimes(2)
    } finally { await worker.close() }
  })

  it('keeps an unconfirmed broker error visible without treating it as a competing retry', async () => {
    const worker = startUptimeWorker(async () => {})
    try {
      const error = Object.assign(new Error('Broker command timed out'), { code: 'ETIMEDOUT' })
      mocks.getState.mockResolvedValueOnce('failed')
      mocks.retry.mockRejectedValueOnce(error)
      const dueAt = new Date()
      await expect(enqueueUptimeProbe({ monitorId: 'monitor_1', version: 1, scheduledAt: dueAt.toISOString(), attempt: 1 }, dueAt)).rejects.toBe(error)
      expect(mocks.getState).toHaveBeenCalledOnce()
    } finally { await worker.close() }
  })

  it('stops worker intake immediately and keeps dispatch available until maintenance drains', async () => {
    const worker = startUptimeWorker(async () => {})
    let finishMaintenance!: () => void
    const pendingMaintenance = new Promise<void>(resolve => { finishMaintenance = resolve })
    const closing = worker.close(pendingMaintenance)
    try {
      expect(mocks.workerClose).toHaveBeenCalledOnce()
      await Promise.resolve()
      expect(mocks.workerDisconnect).toHaveBeenCalledOnce()
      expect(mocks.queueClose).not.toHaveBeenCalled()
      const scheduledAt = new Date().toISOString()
      await enqueueUptimeProbe({ monitorId: 'monitor_1', version: 1, scheduledAt, attempt: 1 }, new Date())
      expect(mocks.add).toHaveBeenCalledOnce()
      expect(mocks.producerDisconnect).not.toHaveBeenCalled()
    } finally {
      finishMaintenance()
      await closing
    }
    expect(mocks.queueClose).toHaveBeenCalledOnce()
    expect(mocks.workerDisconnect).toHaveBeenCalledOnce()
    expect(mocks.producerDisconnect).toHaveBeenCalledOnce()
  })
})
