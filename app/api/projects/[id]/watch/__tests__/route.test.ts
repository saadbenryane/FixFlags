import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  project: { findFirst: vi.fn(), findUnique: vi.fn() },
}))
const getSession = vi.hoisted(() => vi.fn())
const setProjectWatch = vi.hoisted(() => vi.fn())
const fromStoredWatchInterval = vi.hoisted(() => vi.fn())
const productWatchReadiness = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  requestClientId: () => 'test-client',
  RateLimitError: class RateLimitError extends Error { retryAfter = 60 },
}))
vi.mock('@/lib/audit/project-watch', () => ({
  setProjectWatch,
  fromStoredWatchInterval,
  productWatchReadiness,
}))

import { GET, PUT } from '@/app/api/projects/[id]/watch/route'

describe('/api/projects/[id]/watch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    fromStoredWatchInterval.mockReturnValue('weekly')
    productWatchReadiness.mockReturnValue({ ready: true })
    prismaMock.project.findFirst.mockResolvedValue({
      id: 'project-1',
      url: 'https://example.com',
      watchInterval: 'WEEKLY',
      watchNextRunAt: null,
      watchLastRunAt: null,
      watchLastAttemptAt: null,
      watchConsecutiveFailures: 0,
      watchLastError: null,
    })
    setProjectWatch.mockResolvedValue({
      ok: true,
      projectId: 'project-1',
      watchInterval: 'weekly',
    })
    prismaMock.project.findUnique.mockResolvedValue({
      watchInterval: 'WEEKLY',
      watchNextRunAt: null,
      watchLastRunAt: null,
      watchLastAttemptAt: null,
      watchConsecutiveFailures: 0,
      watchLastError: null,
    })
  })

  it('requires sign-in', async () => {
    getSession.mockResolvedValue(null)
    const response = await GET({} as NextRequest, { params: Promise.resolve({ id: 'project-1' }) })
    expect(response.status).toBe(401)
  })

  it('returns owned project watch state', async () => {
    const response = await GET({} as NextRequest, { params: Promise.resolve({ id: 'project-1' }) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.projectId).toBe('project-1')
    expect(body.watchInterval).toBe('weekly')
  })

  it('returns 404 for another user project', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null)
    const response = await GET({} as NextRequest, { params: Promise.resolve({ id: 'other' }) })
    expect(response.status).toBe(404)
  })

  it('enables scheduled reviews for an authenticated Studio Product owner', async () => {
    const enabled = await PUT(
      new NextRequest('http://localhost/api/projects/project-1/watch', {
        method: 'PUT',
        body: JSON.stringify({ interval: 'weekly' }),
      }),
      { params: Promise.resolve({ id: 'project-1' }) }
    )
    expect(enabled.status).toBe(200)
    expect(setProjectWatch).toHaveBeenCalled()

  })

  it('allows daily scheduled reviews and validates interval', async () => {
    const daily = await PUT(
      new NextRequest('http://localhost/api/projects/project-1/watch', {
        method: 'PUT',
        body: JSON.stringify({ interval: 'daily' }),
      }),
      { params: Promise.resolve({ id: 'project-1' }) }
    )
    expect(daily.status).toBe(200)

    const invalid = await PUT(
      new NextRequest('http://localhost/api/projects/project-1/watch', {
        method: 'PUT',
        body: JSON.stringify({ interval: 'hourly' }),
      }),
      { params: Promise.resolve({ id: 'project-1' }) }
    )
    expect(invalid.status).toBe(400)
  })

  it('returns a Studio upgrade response when scheduling is not entitled', async () => {
    setProjectWatch.mockResolvedValueOnce({
      ok: false,
      error: 'Scheduled reviews are available on Studio.',
      code: 'STUDIO_REQUIRED',
    })

    const response = await PUT(
      new NextRequest('http://localhost/api/projects/project-1/watch', {
        method: 'PUT',
        body: JSON.stringify({ interval: 'weekly' }),
      }),
      { params: Promise.resolve({ id: 'project-1' }) }
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'STUDIO_REQUIRED' })
  })
})
