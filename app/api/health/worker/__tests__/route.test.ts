import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ heartbeat: vi.fn(), counts: vi.fn(), oldest: vi.fn(), overdue: vi.fn(), monitoring: vi.fn() }))
vi.mock('@/lib/queue/worker-heartbeat', () => ({ readWorkerHeartbeat: mocks.heartbeat, readStalledJobCount: async () => 0 }))
vi.mock('@/lib/queue/estimate', () => ({ getWorkerExecutionCounts: mocks.counts }))
vi.mock('@/lib/db', () => ({ prisma: { audit: { findFirst: mocks.oldest, count: mocks.overdue } } }))
vi.mock('@/lib/security/rate-limit', () => ({ getRateLimitRedisHealth: () => ({ redisDown: false }) }))
vi.mock('@/lib/health/monitoring', () => ({ readMonitoringHealth: mocks.monitoring }))
const { GET } = await import('../route')

beforeEach(() => {
  vi.resetAllMocks()
  mocks.heartbeat.mockResolvedValue({ alive: true, browserOk: true, workerCount: 1, activeBrowserContexts: 2, configuredConcurrency: 2,
    contextOwnership: { audit: 2, inspection: 0, probe: 0, closing: 0, unattributed: 0, overdue: 0 } })
  mocks.counts.mockResolvedValue({ activeJobs: 2, waitingJobs: 0, delayedJobs: 0 })
  mocks.oldest.mockResolvedValue(null)
  mocks.overdue.mockResolvedValue(0)
  mocks.monitoring.mockResolvedValue({ ok: true, overdueSchedules: 0, overdueUptimeProbes: 0, undeliveredUptimeAlerts: 0, undeliveredWatchAlerts: 0, unsettledSummaries: 0 })
})

it('accounts for browser contexts owned by active progressive execution', async () => {
  const response = await GET()
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true, status: 'ok', queue: { activeJobs: 2 } })
})

it('does not infer a leak from idleness when physical contexts have known owners', async () => {
  mocks.counts.mockResolvedValue({ activeJobs: 0, waitingJobs: 0, delayedJobs: 0 })
  expect(await (await GET()).json()).toMatchObject({ ok: true, status: 'ok' })
})
it.each(['unattributed', 'overdue'])('reports actual %s context evidence', async kind => {
  mocks.heartbeat.mockResolvedValue({ alive: true, browserOk: true, workerCount: 1, activeBrowserContexts: 1,
    contextOwnership: { audit: 0, inspection: 0, probe: 0, closing: 0, unattributed: 0, overdue: 0, [kind]: 1 } })
  expect(await (await GET()).json()).toMatchObject({ ok: false, status: kind === 'overdue' ? 'browser_context_cleanup_overdue' : 'browser_context_unattributed' })
})
it('keeps legacy workers ownership unknown and labels stalled counts as historical events', async () => {
  mocks.heartbeat.mockResolvedValue({ alive: true, browserOk: true, workerCount: 1, activeBrowserContexts: 1 })
  expect(await (await GET()).json()).toMatchObject({ ok: false, status: 'browser_context_ownership_unknown',
    stalledEvents: { scope: 'historical_redis_counter', currentStalledJobs: null } })
})

it('reports missing queue evidence explicitly instead of inventing idleness', async () => {
  mocks.counts.mockRejectedValue(new Error('Queue unavailable'))
  expect(await (await GET()).json()).toMatchObject({ ok: false, status: 'queue_unavailable', queue: null })
})

it('does not describe a missing browser as an ok status', async () => {
  mocks.heartbeat.mockResolvedValue({ alive: true, browserOk: false, workerCount: 1, activeBrowserContexts: 0 })
  expect(await (await GET()).json()).toMatchObject({ ok: false, status: 'browser_unavailable' })
})

it('distinguishes an unreadable execution ledger from confirmed overdue execution', async () => {
  mocks.overdue.mockRejectedValue(new Error('Execution count unavailable'))
  expect(await (await GET()).json()).toMatchObject({ ok: false, status: 'audit_unavailable', overdueAuditCount: null })
})

it.each(['overdueSchedules', 'overdueUptimeProbes', 'inconclusiveUptimeSites', 'undeliveredUptimeAlerts', 'undeliveredWatchAlerts', 'unsettledSummaries'])(
  'reports unfulfilled monitoring despite a live worker and empty queues: %s', async gap => {
    mocks.counts.mockResolvedValue({ activeJobs: 0, waitingJobs: 0, delayedJobs: 0 })
    mocks.heartbeat.mockResolvedValue({ alive: true, browserOk: true, workerCount: 1, activeBrowserContexts: 0 })
    mocks.monitoring.mockResolvedValue({ ok: false, [gap]: 1 })
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: false, status: 'monitoring_gaps', monitoring: { ok: false, [gap]: 1 } })
  },
)

it('exposes unavailable monitoring evidence rather than reporting healthy', async () => {
  mocks.monitoring.mockRejectedValue(new Error('Private database failure'))
  const result = await (await GET()).json()
  expect(result).toMatchObject({ ok: false, status: 'monitoring_unavailable', monitoring: null })
  expect(JSON.stringify(result)).not.toContain('Private database failure')
})
