import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSet, mockEval } = vi.hoisted(() => ({
  mockSet: vi.fn(),
  mockEval: vi.fn(),
}))

vi.mock('@/lib/queue/redis', () => ({
  createQueueRedis: () => ({ set: mockSet, eval: mockEval }),
}))

import { tryAcquireLock, withSchedulerLease } from '@/lib/queue/lock'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('distributed scheduler lock', () => {
  it('releases only its token and aborts after losing renewable ownership', async () => {
    vi.useFakeTimers()
    try {
      mockSet.mockResolvedValue('OK')
      mockEval.mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      const run = withSchedulerLease('test', async signal => {
        await vi.advanceTimersByTimeAsync(10_000)
        expect(signal.aborted).toBe(true)
      })
      await expect(run).resolves.toBe(true)
      expect(mockEval).toHaveBeenCalledTimes(2)
      expect(mockEval.mock.calls[0].slice(1, 4)).toEqual(mockEval.mock.calls[1].slice(1, 4))
      expect(mockEval.mock.calls[1][0]).toContain("redis.call('get', KEYS[1]) == ARGV[1]")
    } finally { vi.useRealTimers() }
  })
  it('uses one atomic NX/PX key and grants only the winning caller', async () => {
    mockSet.mockResolvedValueOnce('OK').mockResolvedValueOnce(null)

    const results = await Promise.all([
      tryAcquireLock('recover-stuck-audits', 110_000),
      tryAcquireLock('recover-stuck-audits', 110_000),
    ])

    expect(results).toEqual([true, false])
    expect(mockSet).toHaveBeenCalledTimes(2)
    for (const call of mockSet.mock.calls) {
      expect(call[0]).toBe('fixflags:lock:recover-stuck-audits')
      expect(call[2]).toBe('PX')
      expect(call[3]).toBe(110_000)
      expect(call[4]).toBe('NX')
    }
  })

  it('fails closed for scheduler ownership when Redis is unavailable', async () => {
    mockSet.mockRejectedValue(new Error('redis unavailable'))

    await expect(tryAcquireLock('project-watches', 240_000)).resolves.toBe(false)
  })
})
