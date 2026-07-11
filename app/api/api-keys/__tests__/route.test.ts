import { describe, it, vi, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

/**
 * Route-level billing gating enforcement (QUALITY.md "Billing enforcement leaks").
 * The gating decision (`canUseApiKeys` -> `canAccessPaidFeatures`) stays REAL so
 * this test verifies the actual wiring: predicate -> 402 for a free user, and a
 * paid user is never blocked on an owned feature.
 */

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  apiKey: { count: vi.fn(), create: vi.fn() },
}))
const getSession = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/env', () => ({ getEnv: () => ({ ADMIN_USER_IDS: [] }) }))
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: vi.fn(),
  requestClientId: () => 'test-client',
  RateLimitError: class RateLimitError extends Error {
    retryAfter = 1
  },
}))
vi.mock('@/lib/security/api-keys', () => ({
  MAX_ACTIVE_API_KEYS: 10,
  generateApiKey: () => ({
    keyHash: 'hash',
    prefix: 'fk_live_abc',
    lastFour: '1234',
    rawKey: 'fk_live_abc...1234',
  }),
}))

import { POST } from '@/app/api/api-keys/route'

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    role: 'user',
    plan: 'FREE',
    subscriptionStatus: 'ACTIVE',
    auditsUsed: 0,
    auditsLimit: 3,
    ...overrides,
  }
}

const postReq = { json: async () => ({ name: 'Test key' }) } as unknown as NextRequest

describe('POST /api/api-keys - billing gating enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.apiKey.count.mockResolvedValue(0)
    prismaMock.apiKey.create.mockResolvedValue({
      id: 'key-1',
      name: 'Test key',
      prefix: 'fk_live_abc',
      lastFour: '1234',
    })
  })

  it('returns 401 when there is no session', async () => {
    getSession.mockResolvedValue(null)

    const res = await POST(postReq)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('returns 402 UPGRADE_REQUIRED for a FREE user on this paid endpoint', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ plan: 'FREE' }))

    const res = await POST(postReq)

    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.code).toBe('UPGRADE_REQUIRED')
    expect(body.action).toBe('upgrade')
    expect(prismaMock.apiKey.create).not.toHaveBeenCalled()
  })

  it('lets a paying (BUILDER) user through - never blocked on an owned feature', async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ plan: 'BUILDER' }))

    const res = await POST(postReq)

    expect(res.status).toBe(201)
    expect(prismaMock.apiKey.create).toHaveBeenCalledTimes(1)
    const body = await res.json()
    expect(body.key).toBeTruthy()
  })

  it('treats a revoked (PAST_DUE) paid subscription as free - 402', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      makeUser({ plan: 'BUILDER', subscriptionStatus: 'PAST_DUE' })
    )

    const res = await POST(postReq)

    expect(res.status).toBe(402)
    expect(prismaMock.apiKey.create).not.toHaveBeenCalled()
  })
})
