import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ heartbeat: vi.fn(), counts: vi.fn(), oldest: vi.fn(), overdue: vi.fn() }))
vi.mock('@/lib/queue/worker-heartbeat', () => ({ readWorkerHeartbeat: mocks.heartbeat, readStalledJobCount: async () => 0 }))
vi.mock('@/lib/queue/estimate', () => ({ getWorkerExecutionCounts: mocks.counts }))
vi.mock('@/lib/db', () => ({ prisma: { audit: { findFirst: mocks.oldest, count: mocks.overdue } } }))
vi.mock('@/lib/security/rate-limit', () => ({ getRateLimitRedisHealth: () => ({ redisDown: false }) }))
const { GET } = await import('../route')

beforeEach(() => {
  vi.resetAllMocks()
  mocks.heartbeat.mockResolvedValue({ alive: true, browserOk: true, workerCount: 1, activeBrowserContexts: 2, configuredConcurrency: 2 })
  mocks.counts.mockResolvedValue({ activeJobs: 2, waitingJobs: 0, delayedJobs: 0 })
  mocks.oldest.mockResolvedValue(null)
  mocks.overdue.mockResolvedValue(0)
})

it('accounts for browser contexts owned by active progressive execution', async () => {
  const response = await GET()
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true, status: 'ok', queue: { activeJobs: 2 } })
})

it('still reports contexts left behind after all execution queues are idle', async () => {
  mocks.counts.mockResolvedValue({ activeJobs: 0, waitingJobs: 0, delayedJobs: 0 })
  expect(await (await GET()).json()).toMatchObject({ ok: false, status: 'browser_context_leak' })
})

it('reports missing queue evidence explicitly instead of inventing idleness', async () => {
  mocks.counts.mockRejectedValue(new Error('Queue unavailable'))
  expect(await (await GET()).json()).toMatchObject({ ok: false, status: 'queue_unavailable', queue: null })
})
