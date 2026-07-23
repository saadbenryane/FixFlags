import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSet } = vi.hoisted(() => ({
  mockSet: vi.fn(),
}))

vi.mock('@/lib/queue/redis', () => ({
  createQueueRedis: () => ({ set: mockSet }),
}))

import { tryAcquireLock } from '@/lib/queue/lock'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('distributed scheduler lock', () => {
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
