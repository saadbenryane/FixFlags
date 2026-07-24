import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  user: { update: vi.fn() },
}))
const getSession = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  requestClientId: () => 'test-client',
  RateLimitError: class RateLimitError extends Error { retryAfter = 60 },
}))

import { PATCH } from '@/app/api/me/preferences/route'

describe('PATCH /api/me/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.user.update.mockResolvedValue({})
  })

  it('requires authentication', async () => {
    getSession.mockResolvedValue(null)
    const response = await PATCH(new NextRequest('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ vibecodingLevel: 'regular' }),
    }))
    expect(response.status).toBe(401)
  })

  it('rejects empty updates and saves valid preferences', async () => {
    const empty = await PATCH(new NextRequest('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ vibecodingLevel: 'wizard' }),
    }))
    expect(empty.status).toBe(400)

    const ok = await PATCH(new NextRequest('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({
        vibecodingLevel: 'advanced',
        preferredTools: ['lovable', 'bolt', 'notepad'],
      }),
    }))
    expect(ok.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        vibecodingLevel: 'advanced',
        preferredTools: ['lovable', 'bolt'],
      },
    })
  })
})
