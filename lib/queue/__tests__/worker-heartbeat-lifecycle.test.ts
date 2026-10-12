import { describe, expect, it, vi } from 'vitest'

const redis = vi.hoisted(() => ({ set: vi.fn(async () => 'OK'), del: vi.fn(async () => 1), disconnect: vi.fn() }))
vi.mock('@/lib/queue/redis', () => ({ createWorkerRedis: () => redis }))

import { beginWorkerShutdown, clearWorkerHeartbeat, touchWorkerHeartbeat } from '../worker-heartbeat'

describe('worker draining heartbeat', () => {
  it('retains stopping state through completion events and stops publication after cleanup', async () => {
    await touchWorkerHeartbeat({ browserOk: true, queueState: 'active' })
    await beginWorkerShutdown()
    await touchWorkerHeartbeat({ queueState: 'idle' })
    const last = redis.set.mock.calls.at(-1) as unknown as [string, string]
    expect(JSON.parse(last[1])).toMatchObject({ queueState: 'stopping', browserOk: true })
    await clearWorkerHeartbeat()
    const published = redis.set.mock.calls.length
    await touchWorkerHeartbeat({ queueState: 'idle' })
    expect(redis.set.mock.calls).toHaveLength(published)
    expect(redis.del).toHaveBeenCalledOnce()
    expect(redis.disconnect).toHaveBeenCalledOnce()
  })
})
