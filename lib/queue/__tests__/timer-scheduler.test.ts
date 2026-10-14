import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTimerScheduler } from '../timer-scheduler'

afterEach(() => vi.useRealTimers())
describe('scheduler shutdown', () => {
  it('keeps different callbacks independent without overlapping the same callback', async () => {
    vi.useFakeTimers()
    let finish!: () => void
    const slow = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    const fast = vi.fn(async () => {})
    const scheduler = createTimerScheduler(vi.fn())
    scheduler.schedule(slow, 5)
    scheduler.schedule(slow, 5, true)
    scheduler.schedule(fast, 5, true)
    try {
      await vi.advanceTimersByTimeAsync(25)
      expect(slow).toHaveBeenCalledOnce()
      expect(fast).toHaveBeenCalledTimes(5)
      finish()
      await vi.advanceTimersByTimeAsync(5)
      expect(slow).toHaveBeenCalledTimes(2)
    } finally {
      finish()
      await scheduler.stop()
    }
  })

  it('does not execute a queued callback after stop', async () => {
    vi.useFakeTimers()
    const tick = vi.fn(async () => {})
    const scheduler = createTimerScheduler(vi.fn())
    scheduler.schedule(tick, 5)
    vi.advanceTimersByTime(5)
    await scheduler.stop()
    expect(tick).not.toHaveBeenCalled()
  })

  it('allows the next tick after a callback fails', async () => {
    vi.useFakeTimers()
    const failure = new Error('Temporary failure')
    const tick = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined)
    const onError = vi.fn()
    const scheduler = createTimerScheduler(onError)
    scheduler.schedule(tick, 5, true)
    await vi.advanceTimersByTimeAsync(10)
    expect(tick).toHaveBeenCalledTimes(2)
    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith(failure)
    await scheduler.stop()
  })

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
