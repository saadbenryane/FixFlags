import { describe, expect, it } from 'vitest'
import { BoundedSemaphore, configuredLimit } from '../capacity'

describe('bounded resource admission', () => {
  it('admits queued availability before another expensive analysis without exceeding capacity', async () => {
    const pool = new BoundedSemaphore(2), order: string[] = []
    const first = await pool.acquire(), second = await pool.acquire()
    const analysis = pool.acquire().then(release => { order.push('analysis'); return release })
    const availability = pool.acquire(undefined, 1).then(release => { order.push('availability'); return release })
    first(); const available = await availability
    expect(order).toEqual(['availability']); expect(pool.running).toBe(2)
    second(); const normal = await analysis
    expect(order).toEqual(['availability', 'analysis']); available(); normal()
    expect(pool.running).toBe(0)
  })
  it('does not exceed capacity and grants queued work in order', async () => {
    const pool = new BoundedSemaphore(2), order: number[] = []
    const a = await pool.acquire(), b = await pool.acquire()
    const third = pool.acquire().then(release => { order.push(3); return release })
    const fourth = pool.acquire().then(release => { order.push(4); return release })
    expect(pool.running).toBe(2); expect(pool.queued).toBe(2)
    a(); const c = await third
    expect(order).toEqual([3]); expect(pool.running).toBe(2)
    b(); const d = await fourth
    expect(order).toEqual([3, 4]); c(); d(); d()
    expect(pool.running).toBe(0)
  })
  it('cancels queued work and releases resources when admitted work fails', async () => {
    const pool = new BoundedSemaphore(1), release = await pool.acquire(), controller = new AbortController()
    const queued = pool.acquire(controller.signal)
    controller.abort(); await expect(queued).rejects.toThrow('cancelled')
    expect(pool.queued).toBe(0); release()
    await expect(pool.run(async () => { throw new Error('browser died') })).rejects.toThrow('browser died')
    expect(pool.running).toBe(0)
    await expect(pool.acquire(AbortSignal.abort())).rejects.toThrow('cancelled')
  })
  it('rejects invalid operational limits', () => {
    for (const value of [0, -1, 1.5, 65, Infinity, NaN]) expect(() => new BoundedSemaphore(value)).toThrow('Invalid')
  })
  it('bounds resource waiters and classifies saturation as retryable rather than a browser crash', async () => {
    const pool = new BoundedSemaphore(1, 1), release = await pool.acquire()
    const queued = pool.acquire()
    await expect(pool.acquire()).rejects.toMatchObject({ code: 'RESOURCE_QUEUE_FULL', retryable: true, crash: false })
    expect(pool.queued).toBe(1)
    release(); const next = await queued; next()
    expect(pool.running).toBe(0)
  })
  it('validates configured resource limits without silently ignoring invalid values', () => {
    expect(configuredLimit('LIMIT', 2, {})).toBe(2)
    expect(configuredLimit('LIMIT', 2, { LIMIT: '4' })).toBe(4)
    for (const LIMIT of ['', '0', '-1', '1.5', '65', 'invalid'])
      expect(() => configuredLimit('LIMIT', 2, { LIMIT })).toThrow('integer')
  })
})
