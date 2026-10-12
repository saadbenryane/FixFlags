import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTimerScheduler } from '../timer-scheduler'

afterEach(() => vi.useRealTimers())
describe('scheduler shutdown', () => {
  it('stops new callbacks while waiting for an admitted callback', async () => {
    vi.useFakeTimers()
    let finish!: () => void
    const active = new Promise<void>(resolve => { finish = resolve })
    const tick = vi.fn(() => active)
    const scheduler = createTimerScheduler(vi.fn())
    scheduler.schedule(tick, 5, true)
    await vi.advanceTimersByTimeAsync(5)
    let stopped = false
    const stopping = scheduler.stop().then(() => { stopped = true })
    await vi.advanceTimersByTimeAsync(100)
    expect(tick).toHaveBeenCalledOnce()
    expect(stopped).toBe(false)
    finish()
    await stopping
    expect(stopped).toBe(true)
  })
})
