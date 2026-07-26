import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  project: { findFirst: vi.fn(), findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
}))
const getSession = vi.hoisted(() => vi.fn())
const setProjectWatch = vi.hoisted(() => vi.fn())
const canAccessProductWatch = vi.hoisted(() => vi.fn())
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
vi.mock('@/lib/auth/entitlements', () => ({ canAccessProductWatch }))

import { GET, PUT } from '@/app/api/projects/[id]/watch/route'

describe('/api/projects/[id]/watch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    canAccessProductWatch.mockReturnValue(true)
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
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'BUILDER',
      role: 'user',
      subscriptionStatus: 'ACTIVE',
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

  it('enables weekly watch for Pro and rejects Free upgrades', async () => {
    const enabled = await PUT(
      new NextRequest('http://localhost/api/projects/project-1/watch', {
        method: 'PUT',
        body: JSON.stringify({ interval: 'weekly' }),
      }),
      { params: Promise.resolve({ id: 'project-1' }) }
    )
    expect(enabled.status).toBe(200)
    expect(setProjectWatch).toHaveBeenCalled()

    canAccessProductWatch.mockReturnValue(false)
    const denied = await PUT(
      new NextRequest('http://localhost/api/projects/project-1/watch', {
        method: 'PUT',
        body: JSON.stringify({ interval: 'weekly' }),
      }),
      { params: Promise.resolve({ id: 'project-1' }) }
    )
    expect(denied.status).toBe(402)
  })

  it('requires Studio for daily watch and validates interval', async () => {
    const daily = await PUT(
      new NextRequest('http://localhost/api/projects/project-1/watch', {
        method: 'PUT',
        body: JSON.stringify({ interval: 'daily' }),
      }),
      { params: Promise.resolve({ id: 'project-1' }) }
    )
    expect(daily.status).toBe(402)

    const invalid = await PUT(
      new NextRequest('http://localhost/api/projects/project-1/watch', {
        method: 'PUT',
        body: JSON.stringify({ interval: 'hourly' }),
      }),
      { params: Promise.resolve({ id: 'project-1' }) }
    )
    expect(invalid.status).toBe(400)
  })
})
