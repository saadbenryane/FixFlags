import { describe, it, vi, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
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

const postReq = { json: async () => ({ name: 'Test key' }) } as unknown as NextRequest

describe('POST /api/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.apiKey.count.mockResolvedValue(0)
    prismaMock.apiKey.create.mockResolvedValue({
      id: 'key-1',
      name: 'Test key',
      prefix: 'fk_live_abc',
      lastFour: '1234',
      client: null,
    })
  })

  it('returns 401 when there is no session', async () => {
    getSession.mockResolvedValue(null)

    const res = await POST(postReq)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('lets a signed-in Free user create an MCP key', async () => {

    const res = await POST(postReq)

    expect(res.status).toBe(201)
    expect(prismaMock.apiKey.create).toHaveBeenCalledTimes(1)
    const body = await res.json()
    expect(body.key).toBeTruthy()
  })

  it('records a supported builder client on the key', async () => {
    prismaMock.apiKey.create.mockResolvedValue({
      id: 'key-1',
      name: 'Lovable MCP',
      prefix: 'fk_live_abc',
      lastFour: '1234',
      client: 'lovable',
    })
    const request = {
      json: async () => ({ name: 'Lovable MCP', client: 'lovable' }),
    } as unknown as NextRequest

    const res = await POST(request)

    expect(res.status).toBe(201)
    expect(prismaMock.apiKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ client: 'lovable' }),
    })
    expect((await res.json()).client).toBe('lovable')
  })

  it('rejects an unsupported builder client', async () => {
    const request = {
      json: async () => ({ client: 'unknown-editor' }),
    } as unknown as NextRequest

    const res = await POST(request)

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('INVALID_API_KEY_CLIENT')
    expect(prismaMock.apiKey.create).not.toHaveBeenCalled()
  })

})
