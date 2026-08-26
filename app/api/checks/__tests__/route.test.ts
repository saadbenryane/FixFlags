import { describe, it, vi, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

/**
 * Route-level billing gating on POST /api/checks (core scan endpoint).
 * Re-checks use a separate route and are never gated on quota.
 * Anon teaser gate lives inside the shared checkAndPlan task service.
 */

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}))
const getSession = vi.hoisted(() => vi.fn())
const checkAndPlan = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/audit/create-audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit/create-audit')>()
  return {
    ...actual,
  }
})
vi.mock('@/lib/audit/task-contracts', () => ({ checkAndPlan }))
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: vi.fn(),
  recordRateLimit: vi.fn().mockResolvedValue({ exceeded: false, retryAfterSeconds: 0 }),
  requestClientId: () => 'test-client',
  RateLimitError: class RateLimitError extends Error {
    retryAfter = 1
  },
}))
vi.mock('@/lib/queue/estimate', () => ({
  getWorkerQueueEstimate: vi.fn().mockResolvedValue({ waitingJobs: 0, queued: false }),
  computeEnqueueDelay: vi.fn().mockReturnValue({
    delayMs: 0,
    queued: false,
    queueReason: undefined,
    queue: {
      state: 'starting',
      jobsAhead: 0,
      estimatedWaitSeconds: 0,
      scheduledStartAt: null,
      workerAvailable: true,
    },
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
    checkAndPlan.mockResolvedValue({
      reportId: 'audit-1',
      reportUrl: 'https://fixflags.com/report/audit-1',
      status: 'QUEUED',
      reused: false,
    })
  })

  it('returns 402 AUTH_REQUIRED when createAndEnqueueAudit rejects anon teaser', async () => {
    checkAndPlan.mockRejectedValue(
      new AuditLimitError('AUTH_REQUIRED', {
        action: 'signup',
        message: 'You’ve used your free scan. Create a free account for fix prompts and more checks.',
      })
    )

    const res = await POST(postReq())

    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.code).toBe('AUTH_REQUIRED')
    expect(body.action).toBe('signup')
  })

  it('returns 201 for unauthenticated critical_path mode (now free for all)', async () => {
    const res = await POST(postReq({ url: 'https://example.com', mode: 'critical_path' }))

    expect(res.status).toBe(201)
    expect(checkAndPlan).toHaveBeenCalled()
    expect(checkAndPlan.mock.calls[0][0].clientId).toBe('test-client')
    const body = await res.json()
    expect(body.reused).toBe(false)
  })

  it('returns reused true when an anonymous check resumes a last-hour public report', async () => {
    checkAndPlan.mockResolvedValue({
      reportId: 'recent-public',
      reportUrl: 'https://fixflags.com/report/recent-public',
      status: 'COMPLETED',
      reused: true,
    })

    const res = await POST(postReq({ url: 'https://example.com' }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toMatchObject({
      reportId: 'recent-public',
      status: 'COMPLETED',
      reused: true,
    })
  })

  it('returns 201 for FREE user on critical_path mode (now free for all)', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ plan: 'FREE' }))

    const res = await POST(postReq({ url: 'https://example.com', mode: 'critical_path' }))

    expect(res.status).toBe(201)
    expect(checkAndPlan).toHaveBeenCalled()
    expect(checkAndPlan.mock.calls[0][0].clientId).toBeUndefined()
  })

  it('returns 402 when createAndEnqueueAudit throws AuditLimitError', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    checkAndPlan.mockRejectedValue(new AuditLimitError('UPGRADE_REQUIRED'))

    const res = await POST(postReq())

    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.code).toBe('UPGRADE_REQUIRED')
    expect(body.action).toBe('upgrade')
  })

  it('returns 402 with buy_credits for paid TOKEN_LIMIT', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    checkAndPlan.mockRejectedValue(
      new AuditLimitError('TOKEN_LIMIT', {
        action: 'buy_credits',
        message: 'New URL check limit reached. Buy credits or upgrade your plan to continue.',
      })
    )

    const res = await POST(postReq())

    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.code).toBe('TOKEN_LIMIT')
    expect(body.action).toBe('buy_credits')
    expect(body.message).toMatch(/buy credits/i)
  })

  it('returns 403 when parentId belongs to another user', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    const { ParentAuditError } = await import('@/lib/audit/create-audit')
    checkAndPlan.mockRejectedValue(
      new ParentAuditError('You can only continue from your own reports', 403)
    )

    const res = await POST(postReq({ url: 'https://example.com', parentId: 'parent-1' }))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('PARENT_AUDIT_INVALID')
    expect(checkAndPlan).toHaveBeenCalled()
  })

  it('returns 401 when anonymous caller passes parentId', async () => {
    const { ParentAuditError } = await import('@/lib/audit/create-audit')
    checkAndPlan.mockRejectedValue(
      new ParentAuditError('Sign in to continue from an existing report', 401)
    )

    const res = await POST(postReq({ url: 'https://example.com', parentId: 'parent-1' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('AUTH_REQUIRED')
  })

  it('returns 201 for anonymous user within limit', async () => {
    const res = await POST(postReq())

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.reportId).toBe('audit-1')
    expect(body.queued).toBe(false)
    expect(body.queue).toEqual({
      state: 'starting',
      jobsAhead: 0,
      estimatedWaitSeconds: 0,
      scheduledStartAt: null,
      workerAvailable: true,
    })
    expect(checkAndPlan).toHaveBeenCalledTimes(1)
    expect(checkAndPlan.mock.calls[0][0].clientId).toBe('test-client')
  })

  it('returns 201 for authenticated BUILDER user on critical_path', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ plan: 'BUILDER' }))

    const res = await POST(postReq({ url: 'https://example.com', mode: 'critical_path' }))

    expect(res.status).toBe(201)
    expect(checkAndPlan).toHaveBeenCalledTimes(1)
  })

  it('returns 401 when scanAccess is sent without a session', async () => {
    const res = await POST(
      postReq({
        url: 'https://preview.example.com',
        scanAccess: { httpBasic: { username: 'user', password: 'pass' } },
      })
    )

    expect(res.status).toBe(401)
    expect(checkAndPlan).not.toHaveBeenCalled()
  })

  it('returns 402 when scanAccess is sent on a non-Studio plan', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ plan: 'BUILDER' }))

    const res = await POST(
      postReq({
        url: 'https://preview.example.com',
        scanAccess: { httpBasic: { username: 'user', password: 'pass' } },
      })
    )

    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.code).toBe('UPGRADE_REQUIRED')
    expect(checkAndPlan).not.toHaveBeenCalled()
  })

  it('passes scanAccess to checkAndPlan for Studio users', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ plan: 'TEAM' }))
    const scanAccess = { httpBasic: { username: 'user', password: 'pass' } }

    const res = await POST(postReq({ url: 'https://preview.example.com', scanAccess }))

    expect(res.status).toBe(201)
    expect(checkAndPlan).toHaveBeenCalledWith(
      expect.objectContaining({ scanAccess })
    )
  })
})
