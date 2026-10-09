import { beforeEach, describe, expect, it, vi } from 'vitest'
const read = vi.hoisted(() => vi.fn())
vi.mock('../worker-heartbeat', () => ({ readWorkerHeartbeat: read }))
import { requireExecutionReady } from '../execution-readiness'
describe('execution readiness', () => {
  beforeEach(() => vi.clearAllMocks())
  it.each([
    { alive: false, browserOk: false, workers: [] },
    { alive: true, browserOk: false, workers: [{ queueState: 'idle' }] },
    { alive: true, browserOk: true, workers: [{ queueState: 'stopping' }] },
  ])('refuses an unavailable scanner', async (heartbeat) => {
    read.mockResolvedValue(heartbeat)
    await expect(requireExecutionReady()).rejects.toMatchObject({ status: 503, code: 'EXECUTION_UNAVAILABLE' })
  })
  it('accepts a healthy busy worker without pretending work has started', async () => {
    read.mockResolvedValue({ alive: true, browserOk: true, workers: [{ queueState: 'active' }] })
    await expect(requireExecutionReady()).resolves.toBeUndefined()
  })
  it('fails closed when Redis is unavailable', async () => {
    read.mockRejectedValue(new Error('unreachable'))
    await expect(requireExecutionReady()).rejects.toMatchObject({ status: 503, code: 'EXECUTION_UNAVAILABLE' })
  })
})
