import { beforeEach, describe, expect, it, vi } from 'vitest'

const redis = vi.hoisted(() => ({ set: vi.fn(async () => 'OK'), del: vi.fn(async () => 1), disconnect: vi.fn() }))
vi.mock('@/lib/queue/redis', () => ({ createQueueRedis: () => redis }))

beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

describe('worker draining heartbeat', () => {
  it('retains stopping state through completion events and stops publication after cleanup', async () => {
    const { beginWorkerShutdown, clearWorkerHeartbeat, touchWorkerHeartbeat } = await import('../worker-heartbeat')
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
  it('releases the diagnostic connection even when deleting the heartbeat fails', async () => {
    const { clearWorkerHeartbeat, touchWorkerHeartbeat } = await import('../worker-heartbeat')
    await touchWorkerHeartbeat({ browserOk: false })
    redis.del.mockRejectedValueOnce(new Error('Diagnostic cleanup timed out'))
    await expect(clearWorkerHeartbeat()).rejects.toThrow('Diagnostic cleanup timed out')
    await clearWorkerHeartbeat()
    await touchWorkerHeartbeat({ browserOk: true })
    expect(redis.disconnect).toHaveBeenCalledOnce()
    expect(redis.del).toHaveBeenCalledOnce()
    expect(redis.set).toHaveBeenCalledOnce()
  })
})
