import { describe, it, vi, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

/**
 * Route-level billing gating enforcement for the projects endpoint
 * (QUALITY.md "Billing enforcement leaks"). Real `projectLimitForPlan` gating:
 * FREE/BUILDER have no project quota (402), TEAM does (allowed).
 */

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  user: { findUnique: vi.fn() },
  project: { count: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
}))
const getSession = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/security/rate-limit', () => ({
  recordRateLimit: vi.fn(),
  requestClientId: () => 'test-client',
  RateLimitError: class RateLimitError extends Error {
    retryAfter = 1
  },
}))

import { POST } from '@/app/api/projects/route'

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    role: 'user',
    plan: 'FREE',
    subscriptionStatus: 'ACTIVE',
    ...overrides,
  }
}

const postReq = {
  json: async () => ({ name: 'My site', url: 'https://example.com' }),
} as unknown as NextRequest

describe('POST /api/projects - billing gating enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (operation) => operation(prismaMock))
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.project.count.mockResolvedValue(0)
    prismaMock.project.findUnique.mockResolvedValue(null)
    prismaMock.project.upsert.mockResolvedValue({ id: 'proj-1', name: 'My site', url: 'https://example.com' })
  })

  it('returns 401 when there is no session', async () => {
    getSession.mockResolvedValue(null)

    const res = await POST(postReq)

    expect(res.status).toBe(401)
    expect(prismaMock.project.upsert).not.toHaveBeenCalled()
  })

  it('returns 402 UPGRADE_REQUIRED for a FREE user (no project quota)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ plan: 'FREE' }))

    const res = await POST(postReq)

    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.code).toBe('UPGRADE_REQUIRED')
    expect(prismaMock.project.upsert).not.toHaveBeenCalled()
  })

  it('lets a TEAM user create a project - never blocked on an owned feature', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ plan: 'TEAM' }))

    const res = await POST(postReq)

    expect(res.status).toBe(201)
    expect(prismaMock.project.upsert).toHaveBeenCalledTimes(1)
  })
})
