import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  $transaction:vi.fn(),$queryRaw:vi.fn(),
  apiKey: { count: vi.fn(), create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
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

import { GET, POST, DELETE } from '@/app/api/api-keys/route'
import { ACCOUNT_CHANGED_CODE, ACCOUNT_OWNER_HEADER } from '@/lib/api/account-response'

const postReq = {
  json: async () => ({ name: 'Test key' }),
} as unknown as NextRequest

describe('POST /api/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async callback=>callback(prismaMock))
    prismaMock.$queryRaw.mockResolvedValue([{id:'user-1'}])
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.apiKey.count.mockResolvedValue(0)
    prismaMock.apiKey.findMany.mockResolvedValue([])
    prismaMock.apiKey.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.apiKey.create.mockResolvedValue({
      id: 'key-1',
      name: 'Test key',
      prefix: 'fk_live_abc',
      lastFour: '1234',
      client: null,
      scopes: ['sites:read', 'runs:read', 'flags:read'],
      expiresAt: new Date('2027-01-03T00:00:00.000Z'),
    })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-05T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const handlers = { GET, POST, DELETE }
  function scopedRequest(method: 'GET' | 'POST' | 'DELETE', owner = 'user-1') {
    return new Request('http://localhost/api/api-keys?id=key-1', { method,
      headers: { [ACCOUNT_OWNER_HEADER]: owner, 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: JSON.stringify({ name: 'Fixture' }) } : {}),
    }) as NextRequest
  }
  it.each(['GET', 'POST', 'DELETE'] as const)('refuses a stale account before %s reads or mutations', async method => {
    const response = await handlers[method](scopedRequest(method, 'previous-account'))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: ACCOUNT_CHANGED_CODE })
    expect(prismaMock.apiKey.findMany).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.apiKey.updateMany).not.toHaveBeenCalled()
  })
  it.each(['GET', 'POST', 'DELETE'] as const)('does not authenticate %s through an account header', async method => {
    getSession.mockResolvedValue(null)
    const response = await handlers[method](scopedRequest(method))
    expect(response.status).toBe(401)
    expect(prismaMock.apiKey.findMany).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.apiKey.updateMany).not.toHaveBeenCalled()
  })
  it.each(['GET', 'POST', 'DELETE'] as const)('identifies private %s responses with the authenticated account', async method => {
    const response = await handlers[method](scopedRequest(method))
    expect(response.status).toBe(method === 'POST' ? 201 : 200)
    expect(response.headers.get(ACCOUNT_OWNER_HEADER)).toBe('user-1')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    if (method === 'DELETE') expect(prismaMock.apiKey.updateMany).toHaveBeenCalledWith({
      where: { id: 'key-1', userId: 'user-1' }, data: { revokedAt: expect.any(Date) },
    })
  })

  it('returns 401 when there is no session', async () => {
    getSession.mockResolvedValue(null)

    const res = await POST(postReq)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('lists only usable keys and never returns their secret material', async () => {
    prismaMock.apiKey.findMany.mockResolvedValue([
      {
        id: 'key-1',
        name: 'Read only',
        prefix: 'fk_live_abc',
        lastFour: '1234',
        client: 'codex',
        scopes: ['sites:read', 'runs:read', 'flags:read'],
        expiresAt: new Date('2027-01-03T00:00:00.000Z'),
        lastUsed: null,
        createdAt: new Date('2026-10-05T00:00:00.000Z'),
      },
    ])

    const res = await GET()

    expect(res.status).toBe(200)
    expect(prismaMock.apiKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          revokedAt: null,
          audience: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date('2026-10-05T00:00:00.000Z') } }],
        },
        select: expect.not.objectContaining({ keyHash: true }),
      })
    )
    const body = await res.json()
    expect(body[0]).toMatchObject({
      scopes: ['sites:read', 'runs:read', 'flags:read'],
      expiresAt: '2027-01-03T00:00:00.000Z',
    })
    expect(JSON.stringify(body)).not.toContain('keyHash')
  })

  it('lets a signed-in Free user create an MCP key', async () => {
    const res = await POST(postReq)

    expect(res.status).toBe(201)
    expect(prismaMock.apiKey.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.apiKey.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        revokedAt: null,
        audience: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date('2026-10-05T00:00:00.000Z') } }],
      },
    })
    expect(prismaMock.apiKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scopes: ['sites:read', 'runs:read', 'flags:read'],
        expiresAt: new Date('2027-01-03T00:00:00.000Z'),
      }),
    })
    const body = await res.json()
    expect(body.key).toBeTruthy()
  })

  it('creates a full workflow key only when that access level is requested', async () => {
    const request = {
      json: async () => ({
        name: 'Release agent',
        scopePreset: 'fix_and_verify',
        expiresInDays: 30,
      }),
    } as unknown as NextRequest

    const res = await POST(request)

    expect(res.status).toBe(201)
    expect(prismaMock.apiKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scopes: ['sites:read', 'runs:read', 'runs:write', 'flags:read', 'flags:write'],
        expiresAt: new Date('2026-11-04T00:00:00.000Z'),
      }),
    })
  })

  it('rejects unknown access and expiration choices before creating a secret', async () => {
    const badScope = await POST({
      json: async () => ({ scopePreset: 'root' }),
    } as unknown as NextRequest)
    expect(badScope.status).toBe(400)
    expect((await badScope.json()).code).toBe('INVALID_API_KEY_SCOPE')

    const badExpiry = await POST({
      json: async () => ({ expiresInDays: 9999 }),
    } as unknown as NextRequest)
    expect(badExpiry.status).toBe(400)
    expect((await badExpiry.json()).code).toBe('INVALID_API_KEY_EXPIRY')
    expect(prismaMock.apiKey.create).not.toHaveBeenCalled()
  })

  it('records a supported builder client on the key', async () => {
    prismaMock.apiKey.create.mockResolvedValue({
      id: 'key-1',
      name: 'Lovable MCP',
      prefix: 'fk_live_abc',
      lastFour: '1234',
      client: 'lovable',
      scopes: ['sites:read', 'runs:read', 'flags:read'],
      expiresAt: new Date('2027-01-03T00:00:00.000Z'),
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
