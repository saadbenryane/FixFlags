import { describe, it, vi, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  audit: { findUnique: vi.fn() },
}))
const resolveSessionUser = vi.hoisted(() => vi.fn())
const canManageAudit = vi.hoisted(() => vi.fn())
const retryAudit = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/audit/fetch-audit', () => ({ resolveSessionUser }))
vi.mock('@/lib/audit/access', () => ({ canManageAudit }))
vi.mock('@/lib/audit/retry-audit', () => ({ retryAudit }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}))
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  requestClientId: () => 'test-client',
  RateLimitError: class RateLimitError extends Error { retryAfter = 60 },
}))

import { POST } from '@/app/api/reports/[id]/retry/route'

function postReq() {
  return { json: async () => ({}) } as unknown as NextRequest
}

function baseAudit(overrides = {}) {
  return {
    userId: 'u1',
    isPublic: false,
    status: 'FAILED',
    triageAt: null,
    failureCode: 'BROWSER_CRASH',
    ...overrides,
  }
}

describe('POST /api/reports/[id]/retry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveSessionUser.mockResolvedValue({ user: { id: 'u1' } })
    canManageAudit.mockReturnValue(true)
  })

  it('returns 404 when the report does not exist', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(null)
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })

  it('returns 403 when the viewer cannot manage the report', async () => {
    canManageAudit.mockReturnValue(false)
    prismaMock.audit.findUnique.mockResolvedValue(baseAudit())
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'a1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 400 when the report is not failed or degraded', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(baseAudit({ status: 'COMPLETED', triageAt: new Date() }))
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'a1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 200 and enqueues retry when audit is FAILED', async () => {
    retryAudit.mockResolvedValue({ status: 'QUEUED' })
    prismaMock.audit.findUnique.mockResolvedValue(baseAudit({ status: 'FAILED' }))
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'a1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('QUEUED')
    expect(retryAudit).toHaveBeenCalledWith('a1')
  })

  it('returns 200 and enqueues retry when audit is AI-degraded (completed without triage)', async () => {
    retryAudit.mockResolvedValue({ status: 'QUEUED' })
    prismaMock.audit.findUnique.mockResolvedValue(
      baseAudit({ status: 'COMPLETED', triageAt: null, failureCode: 'AI_FAILURE' })
    )
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'a1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('QUEUED')
  })
})
