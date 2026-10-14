vi.mock('@/lib/queue/worker-heartbeat', () => ({ touchWorkerHeartbeat: vi.fn().mockResolvedValue(undefined) }))
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ close: vi.fn(), schedule: vi.fn(), alerts: vi.fn(), retention: vi.fn() }))
vi.mock('./queue', () => ({ startUptimeWorker: () => ({ close: mocks.close }) }))
vi.mock('./service', () => ({ executeUptimeProbe: vi.fn(), scheduleUptimeProbes: mocks.schedule, retainUptimeHistory: mocks.retention }))
vi.mock('./alerts', () => ({ deliverUptimeNotifications: mocks.alerts }))
import { startUptimeRuntime } from './runtime'
import { touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); mocks.close.mockResolvedValue(undefined); mocks.schedule.mockResolvedValue(undefined); mocks.alerts.mockResolvedValue(undefined); mocks.retention.mockResolvedValue(undefined) })
afterEach(() => vi.useRealTimers())
describe('independent Uptime worker maintenance', () => {
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
    mocks.schedule.mockReturnValue(new Promise<void>(done => { resolve = done }))
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
