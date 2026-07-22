import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  shareLink: { findUnique: vi.fn(), updateMany: vi.fn() },
}))
const verifySharePassword = vi.hoisted(() => vi.fn())
const enforceRateLimit = vi.hoisted(() => vi.fn())
const canSharePublicly = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/security/share-password', () => ({ verifySharePassword }))
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit,
  requestClientId: () => 'test-client',
  RateLimitError: class RateLimitError extends Error { retryAfter = 60 },
}))
vi.mock('@/lib/auth/entitlements', () => ({ canSharePublicly }))

import { GET, POST } from '@/app/api/share/[token]/route'

const baseLink = {
  id: 'share-1',
  auditId: 'audit-1',
  revoked: false,
  expiresAt: null,
  maxViews: null,
  viewCount: 0,
  passwordHash: null,
  version: 1,
  audit: {
    status: 'COMPLETED',
    user: { id: 'owner-1', role: 'user', plan: 'TEAM', subscriptionStatus: 'ACTIVE' },
  },
}

describe('/api/share/[token]', () => {
  const originalSecret = process.env.BETTER_AUTH_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BETTER_AUTH_SECRET = 'test-share-secret-that-is-long-enough'
    prismaMock.shareLink.findUnique.mockResolvedValue(baseLink)
    prismaMock.shareLink.updateMany.mockResolvedValue({ count: 1 })
    verifySharePassword.mockResolvedValue(true)
    canSharePublicly.mockReturnValue(true)
  })

  afterEach(() => {
    process.env.BETTER_AUTH_SECRET = originalSecret
  })

  it('authorizes a token-only link, increments once, and sets a scoped HttpOnly grant', async () => {
    const response = (await GET(new NextRequest('http://localhost/api/share/token-1'), {
      params: Promise.resolve({ token: 'token-1' }),
    }))!
    expect(response.status).toBe(307)
    expect(prismaMock.shareLink.updateMany).toHaveBeenCalledTimes(1)
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i)
    expect(response.headers.get('set-cookie')).toContain('Path=/')
    expect(response.headers.get('location')).toBe('http://localhost/share/token-1')
  })

  it('rejects the wrong password without consuming a view', async () => {
    prismaMock.shareLink.findUnique.mockResolvedValue({ ...baseLink, passwordHash: 'scrypt$hash' })
    verifySharePassword.mockResolvedValue(false)
    const request = new NextRequest('http://localhost/api/share/token-1', {
      method: 'POST',
      body: JSON.stringify({ password: 'wrong' }),
      headers: { 'content-type': 'application/json' },
    })
    const response = (await POST(request, { params: Promise.resolve({ token: 'token-1' }) }))!
    expect(response.status).toBe(401)
    expect(prismaMock.shareLink.updateMany).not.toHaveBeenCalled()
  })

  it('enforces max views atomically', async () => {
    prismaMock.shareLink.findUnique.mockResolvedValue({ ...baseLink, maxViews: 1, viewCount: 1 })
    const response = (await GET(new NextRequest('http://localhost/api/share/token-1'), {
      params: Promise.resolve({ token: 'token-1' }),
    }))!
    expect(response.status).toBe(410)
    expect(prismaMock.shareLink.updateMany).not.toHaveBeenCalled()
  })

  it('invalidates links when the owner loses Agency entitlement', async () => {
    canSharePublicly.mockReturnValue(false)
    const response = (await GET(new NextRequest('http://localhost/api/share/token-1'), {
      params: Promise.resolve({ token: 'token-1' }),
    }))!
    expect(response.status).toBe(403)
    expect(prismaMock.shareLink.updateMany).not.toHaveBeenCalled()
  })

  it('fails closed when the atomic admission loses a race', async () => {
    prismaMock.shareLink.updateMany.mockResolvedValue({ count: 0 })
    const response = (await GET(new NextRequest('http://localhost/api/share/token-1'), {
      params: Promise.resolve({ token: 'token-1' }),
    }))!
    expect(response.status).toBe(410)
  })
})
