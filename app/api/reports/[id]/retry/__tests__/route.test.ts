import { describe, it, vi, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  audit: { findUnique: vi.fn() },
}))
const resolveSessionUser = vi.hoisted(() => vi.fn())
const canManageAudit = vi.hoisted(() => vi.fn())
const canRetryAnonymousAudit = vi.hoisted(() => vi.fn())
const retryAudit = vi.hoisted(() => vi.fn())
const readClaimedAnonymousIds = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/audit/fetch-audit', () => ({ resolveSessionUser }))
vi.mock('@/lib/audit/access', () => ({ canManageAudit, canRetryAnonymousAudit }))
vi.mock('@/lib/audit/retry-audit', () => ({ retryAudit }))
vi.mock('@/lib/audit/usage', () => ({
  ANON_AUDIT_IDS_COOKIE: 'ff_anon_report_ids',
  readClaimedAnonymousIds,
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => ({ value: '["anon-1"]' }),
  }),
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
    canRetryAnonymousAudit.mockReturnValue(false)
    readClaimedAnonymousIds.mockResolvedValue(['anon-1'])
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

  it('allows an anonymous visitor to retry their own failed teaser (cookie-gated)', async () => {
    resolveSessionUser.mockResolvedValue(null)
    canManageAudit.mockReturnValue(false)
    canRetryAnonymousAudit.mockReturnValue(true)
    retryAudit.mockResolvedValue({ status: 'QUEUED' })
    prismaMock.audit.findUnique.mockResolvedValue(baseAudit({ userId: null, isPublic: false }))
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'anon-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('QUEUED')
    expect(canRetryAnonymousAudit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, isPublic: false }),
      'anon-1',
      ['anon-1']
    )
    expect(retryAudit).toHaveBeenCalledWith('anon-1')
  })

  it('returns 403 for an anonymous teaser not present in the anon cookie', async () => {
    resolveSessionUser.mockResolvedValue(null)
    canManageAudit.mockReturnValue(false)
    canRetryAnonymousAudit.mockReturnValue(false)
    prismaMock.audit.findUnique.mockResolvedValue(baseAudit({ userId: null, isPublic: false }))
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'other-audit' }) })
    expect(res.status).toBe(403)
  })

  it('never allows retry of a public marketing sample through the anon path', async () => {
    resolveSessionUser.mockResolvedValue(null)
    canManageAudit.mockReturnValue(false)
    canRetryAnonymousAudit.mockReturnValue(false)
    prismaMock.audit.findUnique.mockResolvedValue(baseAudit({ userId: null, isPublic: true }))
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'sample-1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 403 for a signed-in user who cannot manage an anonymous audit', async () => {
    resolveSessionUser.mockResolvedValue({ user: { id: 'u2' } })
    canManageAudit.mockReturnValue(false)
    canRetryAnonymousAudit.mockReturnValue(false)
    prismaMock.audit.findUnique.mockResolvedValue(baseAudit({ userId: null }))
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
