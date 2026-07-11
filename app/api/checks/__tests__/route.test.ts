import { describe, it, vi, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

/**
 * Route-level billing gating on POST /api/checks (core scan endpoint).
 * Re-checks use a separate route and are never gated on quota.
 */

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}))
const getSession = vi.hoisted(() => vi.fn())
const createAndEnqueueAudit = vi.hoisted(() => vi.fn())
const checkAnonymousAuditAllowed = vi.hoisted(() => vi.fn())
const trackAnonymousAuditId = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/audit/create-audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit/create-audit')>()
  return {
    ...actual,
    createAndEnqueueAudit,
  }
})
vi.mock('@/lib/audit/usage', () => ({
  checkAnonymousAuditAllowed,
  trackAnonymousAuditId,
}))
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: vi.fn(),
  recordRateLimit: vi.fn().mockResolvedValue({ exceeded: false, retryAfterSeconds: 0 }),
  requestClientId: () => 'test-client',
  RateLimitError: class RateLimitError extends Error {
    retryAfter = 1
  },
}))
vi.mock('@/lib/queue/estimate', () => ({
  getWorkerQueueEstimate: vi.fn().mockResolvedValue({ waitingJobs: 0 }),
  computeEnqueueDelay: vi.fn().mockReturnValue({
    delayMs: 0,
    estimatedWaitSeconds: 0,
    queuePosition: 0,
    scheduledStartAt: null,
  }),
}))

import { POST } from '@/app/api/checks/route'
import { AuditLimitError } from '@/lib/audit/create-audit'

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    role: 'user',
    plan: 'FREE',
    subscriptionStatus: 'ACTIVE',
    ...overrides,
  }
}

function postReq(body: Record<string, unknown> = { url: 'https://example.com' }) {
  return {
    json: async () => body,
    headers: new Headers(),
    nextUrl: new URL('http://localhost/api/checks'),
  } as unknown as NextRequest
}

describe('POST /api/checks - billing gating enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue(null)
    checkAnonymousAuditAllowed.mockResolvedValue({ allowed: true })
    createAndEnqueueAudit.mockResolvedValue({ auditId: 'audit-1', status: 'QUEUED' })
    trackAnonymousAuditId.mockResolvedValue(undefined)
  })

  it('returns 402 UPGRADE_REQUIRED for anonymous user over limit', async () => {
    checkAnonymousAuditAllowed.mockResolvedValue({
      allowed: false,
      error: 'Sign in to run more checks',
      code: 'UPGRADE_REQUIRED',
      action: 'sign_in',
    })

    const res = await POST(postReq())

    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.code).toBe('UPGRADE_REQUIRED')
    expect(createAndEnqueueAudit).not.toHaveBeenCalled()
  })

  it('returns 201 for unauthenticated critical_path mode (now free for all)', async () => {
    const res = await POST(postReq({ url: 'https://example.com', mode: 'critical_path' }))

    expect(res.status).toBe(201)
    expect(createAndEnqueueAudit).toHaveBeenCalled()
  })

  it('returns 201 for FREE user on critical_path mode (now free for all)', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ plan: 'FREE' }))

    const res = await POST(postReq({ url: 'https://example.com', mode: 'critical_path' }))

    expect(res.status).toBe(201)
    expect(createAndEnqueueAudit).toHaveBeenCalled()
  })

  it('returns 402 when createAndEnqueueAudit throws AuditLimitError', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    createAndEnqueueAudit.mockRejectedValue(new AuditLimitError('UPGRADE_REQUIRED'))

    const res = await POST(postReq())

    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.code).toBe('UPGRADE_REQUIRED')
    expect(body.action).toBe('upgrade')
  })

  it('returns 201 for anonymous user within limit', async () => {
    const res = await POST(postReq())

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.reportId).toBe('audit-1')
    expect(createAndEnqueueAudit).toHaveBeenCalledTimes(1)
    expect(trackAnonymousAuditId).toHaveBeenCalledWith('audit-1')
  })

  it('returns 201 for authenticated BUILDER user on critical_path', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ plan: 'BUILDER' }))

    const res = await POST(postReq({ url: 'https://example.com', mode: 'critical_path' }))

    expect(res.status).toBe(201)
    expect(createAndEnqueueAudit).toHaveBeenCalledTimes(1)
  })
})
