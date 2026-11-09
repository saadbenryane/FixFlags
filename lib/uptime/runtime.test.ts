vi.mock('@/lib/queue/worker-heartbeat', () => ({ touchWorkerHeartbeat: vi.fn().mockResolvedValue(undefined) }))
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ close: vi.fn(), checkReady: vi.fn(), schedule: vi.fn(), initialize: vi.fn(), alerts: vi.fn(), retention: vi.fn() }))
vi.mock('./queue', () => ({ startUptimeWorker: () => ({ close: mocks.close, checkReady: mocks.checkReady }) }))
vi.mock('./service', () => ({ executeUptimeProbe: vi.fn(), dispatchDueUptimeProbes: mocks.schedule, initializeUptimeMonitors: mocks.initialize, retainUptimeHistory: mocks.retention }))
vi.mock('./alerts', () => ({ deliverUptimeNotifications: mocks.alerts }))
import { startUptimeRuntime } from './runtime'
import { touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); mocks.close.mockResolvedValue(undefined); mocks.checkReady.mockResolvedValue(true); mocks.initialize.mockResolvedValue(undefined); mocks.schedule.mockResolvedValue({ published: 0, failed: 0 }); mocks.alerts.mockResolvedValue(undefined); mocks.retention.mockResolvedValue(false) })
afterEach(() => vi.useRealTimers())
describe('independent Uptime worker maintenance', () => {
  it('keeps dispatch and alerts running while monitor setup is slow without overlapping setup', async () => {
    let finish!: () => void
    mocks.initialize.mockReturnValue(new Promise<void>(resolve => { finish = resolve }))
    const runtime = startUptimeRuntime()
    try {
      await vi.advanceTimersByTimeAsync(301_000)
      expect(mocks.initialize).toHaveBeenCalledOnce()
      expect(mocks.schedule).toHaveBeenCalledTimes(11)
      expect(mocks.alerts).toHaveBeenCalledTimes(11)
      expect(mocks.retention).toHaveBeenCalledOnce()
    } finally { finish(); await runtime.close() }
  })
  it('retries failed monitor setup without stopping due probes or alerts', async () => {
    mocks.initialize.mockRejectedValue(new Error('Monitor setup unavailable'))
    const runtime = startUptimeRuntime()
    try {
      await vi.advanceTimersByTimeAsync(61_000)
      expect(mocks.initialize).toHaveBeenCalledTimes(3)
      expect(mocks.schedule).toHaveBeenCalledTimes(3)
      expect(mocks.alerts).toHaveBeenCalledTimes(3)
    } finally { await runtime.close() }
  })
  it('keeps dispatching probes while notification delivery is slow without overlapping deliveries', async () => {
    let finishDelivery!: () => void
    mocks.alerts.mockReturnValue(new Promise<void>(resolve => { finishDelivery = resolve }))
    const runtime = startUptimeRuntime()
    try {
      await vi.advanceTimersByTimeAsync(301_000)
      expect(mocks.schedule).toHaveBeenCalledTimes(11)
      expect(mocks.alerts).toHaveBeenCalledOnce()
      expect(mocks.retention).toHaveBeenCalledOnce()
      expect(touchWorkerHeartbeat).toHaveBeenCalledWith(expect.objectContaining({ uptimeReady: true }))
    } finally {
      finishDelivery()
      await runtime.close()
    }
  })

  it('runs notifications and cleanup even when dispatch fails', async () => {
    mocks.schedule.mockRejectedValue(new Error('Dispatch unavailable'))
    const runtime = startUptimeRuntime()
    try {
      await vi.advanceTimersByTimeAsync(1_000)
      expect(mocks.alerts).toHaveBeenCalledOnce()
      expect(mocks.retention).toHaveBeenCalledOnce()
      expect(touchWorkerHeartbeat).toHaveBeenCalledWith({ uptimeReady: false })
    } finally {
      await runtime.close()
    }
  })

  it('marks a failed dispatch cohort unready and recovers when another publication succeeds', async () => {
    mocks.schedule.mockResolvedValueOnce({ published: 0, failed: 2 }).mockResolvedValueOnce({ published: 1, failed: 1 })
    const runtime = startUptimeRuntime()
    try {
      await vi.advanceTimersByTimeAsync(1000)
      expect(touchWorkerHeartbeat).toHaveBeenCalledExactlyOnceWith({ uptimeReady: false })
      expect(mocks.alerts).toHaveBeenCalledOnce()
      await vi.advanceTimersByTimeAsync(29_000)
      expect(touchWorkerHeartbeat).toHaveBeenLastCalledWith({ uptimeReady: true, lastUptimeSweepAt: new Date().toISOString() })
    } finally { await runtime.close() }
  })

  it('requires the queue consumer even during empty dispatch sweeps', async () => {
    mocks.checkReady.mockResolvedValueOnce(false)
    const runtime = startUptimeRuntime()
    try {
      await vi.advanceTimersByTimeAsync(1000)
      expect(touchWorkerHeartbeat).toHaveBeenCalledExactlyOnceWith({ uptimeReady: false })
      await vi.advanceTimersByTimeAsync(29_000)
      expect(touchWorkerHeartbeat).toHaveBeenLastCalledWith({ uptimeReady: true, lastUptimeSweepAt: new Date().toISOString() })
    } finally { await runtime.close() }
  })

  it('keeps monitoring ready when only notification delivery fails', async () => {
    mocks.alerts.mockRejectedValue(new Error('Email unavailable'))
    const runtime = startUptimeRuntime()
    try {
      await vi.advanceTimersByTimeAsync(1_000)
      expect(mocks.retention).toHaveBeenCalledOnce()
      expect(touchWorkerHeartbeat).toHaveBeenCalledWith(expect.objectContaining({ uptimeReady: true }))
      expect(touchWorkerHeartbeat).not.toHaveBeenCalledWith({ uptimeReady: false })
    } finally {
      await runtime.close()
    }
  })

  it('runs bounded periodic maintenance and stops dispatching after shutdown', async () => {
    const runtime = startUptimeRuntime()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(mocks.schedule).toHaveBeenCalledOnce(); expect(mocks.alerts).toHaveBeenCalledOnce(); expect(mocks.retention).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mocks.schedule).toHaveBeenCalledTimes(2); expect(mocks.retention).toHaveBeenCalledOnce()
    await runtime.close()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mocks.schedule).toHaveBeenCalledTimes(2); expect(mocks.close).toHaveBeenCalledOnce()
  })
  it('continues an expired-probe backlog across maintenance ticks, then waits until the next daily sweep', async () => {
    mocks.retention.mockResolvedValueOnce(true).mockResolvedValueOnce(true)
    const runtime = startUptimeRuntime()
    try {
      await vi.advanceTimersByTimeAsync(61_000)
      expect(mocks.retention).toHaveBeenCalledTimes(3)
      expect(mocks.schedule).toHaveBeenCalledTimes(3)
      expect(mocks.alerts).toHaveBeenCalledTimes(3)
      await vi.advanceTimersByTimeAsync(60_000)
      expect(mocks.retention).toHaveBeenCalledTimes(3)
    } finally { await runtime.close() }
  })
  it('does not start maintenance queued by a timer when shutdown has already begun', async () => {
    const runtime = startUptimeRuntime()
    vi.advanceTimersByTime(1_000)
    await runtime.close()
    expect(mocks.schedule).not.toHaveBeenCalled()
    expect(mocks.alerts).not.toHaveBeenCalled()
    expect(mocks.retention).not.toHaveBeenCalled()
  })
  it('stops intake immediately and waits for both the active sweep and queue drain', async () => {
    let resolve!: () => void, drain!: () => void
    mocks.close.mockReturnValue(new Promise<void>(done => { drain = done }))
    mocks.schedule.mockReturnValue(new Promise(done => { resolve = () => done({ published: 0, failed: 0 }) }))
    const runtime = startUptimeRuntime()
    await vi.advanceTimersByTimeAsync(61_000)
    expect(mocks.schedule).toHaveBeenCalledOnce()
    const closing = runtime.close()
    expect(mocks.close).toHaveBeenCalledOnce()
    let settled = false
    void closing.then(() => { settled = true })
    resolve()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(settled).toBe(false)
    expect(mocks.schedule).toHaveBeenCalledOnce()
    drain(); await closing
    expect(settled).toBe(true)
  })
})
