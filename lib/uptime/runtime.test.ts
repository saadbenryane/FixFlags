import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ close: vi.fn(), schedule: vi.fn(), alerts: vi.fn(), retention: vi.fn() }))
vi.mock('./queue', () => ({ startUptimeWorker: () => ({ close: mocks.close }) }))
vi.mock('./service', () => ({ executeUptimeProbe: vi.fn(), scheduleUptimeProbes: mocks.schedule, retainUptimeHistory: mocks.retention }))
vi.mock('./alerts', () => ({ deliverUptimeNotifications: mocks.alerts }))
import { startUptimeRuntime } from './runtime'
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); mocks.close.mockResolvedValue(undefined); mocks.schedule.mockResolvedValue(undefined); mocks.alerts.mockResolvedValue(undefined); mocks.retention.mockResolvedValue(undefined) })
afterEach(() => vi.useRealTimers())
describe('independent Uptime worker maintenance', () => {
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
  it('waits for an in-flight sweep before closing queue resources and avoids overlapping sweeps', async () => {
    let resolve!: () => void
    mocks.schedule.mockReturnValue(new Promise<void>(done => { resolve = done }))
    const runtime = startUptimeRuntime()
    await vi.advanceTimersByTimeAsync(61_000)
    expect(mocks.schedule).toHaveBeenCalledOnce()
    const closing = runtime.close()
    expect(mocks.close).not.toHaveBeenCalled()
    resolve(); await closing
    expect(mocks.close).toHaveBeenCalledOnce()
  })
})
