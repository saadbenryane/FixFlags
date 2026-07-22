import { beforeEach, describe, expect, it, vi } from 'vitest'

const readLaunchReadiness = vi.fn()

vi.mock('@/lib/health/readiness', () => ({ readLaunchReadiness }))

describe('GET /api/health/ready', () => {
  beforeEach(() => readLaunchReadiness.mockReset())

  it('returns 200 when every launch subsystem is ready', async () => {
    readLaunchReadiness.mockResolvedValue({ ok: true, checkedAt: 'now', missing: [], subsystems: {} })
    const { GET } = await import('../route')
    const response = await GET()
    expect(response.status).toBe(200)
  })

  it('returns 503 with named missing subsystems', async () => {
    readLaunchReadiness.mockResolvedValue({
      ok: false,
      checkedAt: 'now',
      missing: ['worker'],
      subsystems: { worker: { ok: false, detail: 'No current worker heartbeat' } },
    })
    const { GET } = await import('../route')
    const response = await GET()
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ ok: false, missing: ['worker'] })
  })
})
