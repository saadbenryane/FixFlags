import { describe, it, vi, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

/**
 * Route-level billing gating enforcement for the projects endpoint
 * (QUALITY.md "Billing enforcement leaks"). Real `projectLimitForPlan` gating:
 * Free supports one Product, Pro supports five, and Studio is unlimited.
 */

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
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
    prismaMock.$executeRaw.mockResolvedValue(1)
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

  it('lets a Free user create a Product', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ plan: 'FREE' }))

    const res = await POST(postReq)

    expect(res.status).toBe(201)
    expect(prismaMock.project.upsert).toHaveBeenCalledTimes(1)
  })

  it('stops a Free user from creating a second Product', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ plan: 'FREE' }))
    prismaMock.project.count.mockResolvedValue(1)

    const res = await POST(postReq)

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'PROJECT_LIMIT' })
    expect(prismaMock.project.upsert).not.toHaveBeenCalled()
  })

  it('stops a Pro user from creating a sixth Product', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ plan: 'BUILDER' }))
    prismaMock.project.count.mockResolvedValue(5)

    const res = await POST(postReq)

    expect(res.status).toBe(409)
    expect(prismaMock.project.upsert).not.toHaveBeenCalled()
  })

  it('lets a Studio user create Products without a product-count gate', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ plan: 'TEAM' }))
    prismaMock.project.count.mockResolvedValue(500)

    const res = await POST(postReq)

    expect(res.status).toBe(201)
    expect(prismaMock.project.upsert).toHaveBeenCalledTimes(1)
    expect(prismaMock.project.count).not.toHaveBeenCalled()
  })
})
