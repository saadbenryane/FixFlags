import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getSession = vi.hoisted(() => vi.fn())
const findUser = vi.hoisted(() => vi.fn())
const decideCliDeviceAuthorization = vi.hoisted(() => vi.fn())
const getCliAuthorizationForUserCode = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: findUser } } }))
vi.mock('@/lib/env', () => ({ getEnv: () => ({ ADMIN_USER_IDS: [] }) }))
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: vi.fn(),
  requestClientId: () => 'test-client',
  RateLimitError: class RateLimitError extends Error {
    retryAfter = 1
  },
}))
vi.mock('@/lib/cli/device-auth', () => ({
  decideCliDeviceAuthorization,
  getCliAuthorizationForUserCode,
}))

import { GET, POST } from '@/app/api/cli/auth/authorize/route'

describe('/api/cli/auth/authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    findUser.mockResolvedValue({
      id: 'user-1',
      plan: 'BUILDER',
      subscriptionStatus: 'ACTIVE',
      role: 'user',
    })
  })

  it('requires an authenticated browser session', async () => {
    getSession.mockResolvedValue(null)
    const response = await GET(
      new NextRequest(
        'http://localhost/api/cli/auth/authorize?user_code=ABCD-EFGH'
      )
    )
    expect(response.status).toBe(401)
  })

  it('approves a pending code for a paid user', async () => {
    decideCliDeviceAuthorization.mockResolvedValue({
      ok: true,
      status: 'APPROVED',
    })
    const response = await POST(
      new NextRequest('http://localhost/api/cli/auth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userCode: 'ABCD-EFGH',
          decision: 'approve',
        }),
      })
    )
    expect(response.status).toBe(200)
    expect(decideCliDeviceAuthorization).toHaveBeenCalledWith({
      userCode: 'ABCD-EFGH',
      userId: 'user-1',
      approve: true,
    })
  })

  it('supports explicit denial without minting a credential', async () => {
    decideCliDeviceAuthorization.mockResolvedValue({
      ok: true,
      status: 'DENIED',
    })
    const response = await POST(
      new NextRequest('http://localhost/api/cli/auth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCode: 'ABCD-EFGH', decision: 'deny' }),
      })
    )
    expect(response.status).toBe(200)
    expect(decideCliDeviceAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({ approve: false })
    )
  })
})
