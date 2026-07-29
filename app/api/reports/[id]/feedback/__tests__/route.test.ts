import { describe, it, vi, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  audit: { findUnique: vi.fn() },
  auditFeedback: { upsert: vi.fn() },
}))
const getSession = vi.hoisted(() => vi.fn())
const getOrCreateVisitorToken = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}))
vi.mock('@/lib/live-support/visitor-token', () => ({ getOrCreateVisitorToken }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}))
vi.mock('@/lib/security/rate-limit', () => ({
  recordRateLimit: vi.fn().mockResolvedValue(undefined),
  requestClientId: () => 'test-client',
}))

import { POST } from '@/app/api/reports/[id]/feedback/route'

function postReq(body: Record<string, unknown> = {}) {
  return { json: async () => body } as unknown as NextRequest
}

describe('POST /api/reports/[id]/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue(null)
    getOrCreateVisitorToken.mockResolvedValue('vt_abc123')
    prismaMock.auditFeedback.upsert.mockResolvedValue({ id: 'fb1', vote: 1 })
  })

  it('returns 404 when the report does not exist', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(null)
    const res = await POST(postReq({ vote: 1 }), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid feedback body', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({ id: 'a1' })
    const res = await POST(postReq({}), { params: Promise.resolve({ id: 'a1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 400 when vote is out of range', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({ id: 'a1' })
    const res = await POST(postReq({ vote: 99 }), { params: Promise.resolve({ id: 'a1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 200 and upserts feedback for valid request', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({ id: 'a1' })
    const res = await POST(postReq({ vote: 1, comment: 'Great report!' }), {
      params: Promise.resolve({ id: 'a1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('fb1')
    expect(prismaMock.auditFeedback.upsert).toHaveBeenCalled()
  })

  it('associates feedback with authenticated user when session exists', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    prismaMock.audit.findUnique.mockResolvedValue({ id: 'a1' })
    await POST(postReq({ vote: -1 }), { params: Promise.resolve({ id: 'a1' }) })
    expect(prismaMock.auditFeedback.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: 'u1' }),
      })
    )
  })

  it('stores pageUrl when provided', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({ id: 'a1' })
    await POST(
      postReq({ vote: 1, pageUrl: 'https://example.com/page' }),
      { params: Promise.resolve({ id: 'a1' }) }
    )
    expect(prismaMock.auditFeedback.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ pageUrl: 'https://example.com/page' }),
      })
    )
  })
})
