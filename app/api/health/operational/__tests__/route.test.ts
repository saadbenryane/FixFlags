import { beforeEach, expect, it, vi } from 'vitest'

const read = vi.hoisted(() => vi.fn())
vi.mock('@/lib/health/operational', () => ({ readWorkerOperationalHealth: read }))
const { GET } = await import('../route')
beforeEach(() => vi.resetAllMocks())

it('returns an uncached success only for the shared healthy operational assessment', async () => {
  read.mockResolvedValue({ ok: true, status: 'ok', worker: { workerId: 'private-detail' } })
  const response = await GET()
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await response.json()).toEqual({ ok: true, status: 'ok' })
})

it.each(['worker_down', 'monitoring_gaps', 'browser_context_cleanup_overdue', 'queue_unavailable'])(
  'makes %s observable to a status-only continuous monitor', async status => {
    read.mockResolvedValue({ ok: false, status })
    const response = await GET()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ ok: false, status })
  },
)

it('fails closed without disclosing underlying dependency errors', async () => {
  read.mockRejectedValue(new Error('private database connection details'))
  const response = await GET()
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ ok: false, status: 'operational_health_unavailable' })
})
