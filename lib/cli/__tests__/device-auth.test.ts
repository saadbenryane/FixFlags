import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  authorization: {} as Record<string, unknown>,
}))
const prisma = vi.hoisted(() => ({
  cliDeviceAuthorization: {
    findUnique: vi.fn(async () => ({ ...state.authorization })),
    update: vi.fn(async ({ data }) => {
      Object.assign(state.authorization, data)
      return state.authorization
    }),
    updateMany: vi.fn(async ({ where, data }) => {
      if (state.authorization.status !== where.status) return { count: 0 }
      Object.assign(state.authorization, data)
      return { count: 1 }
    }),
    create: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  apiKey: { count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(async (input) =>
    typeof input === 'function' ? input(prisma) : Promise.all(input)
  ),
}))

vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/lib/security/crypto', () => ({
  encryptSecret: (value: string) => `encrypted:${value}`,
  decryptSecret: (value: string) => value.replace('encrypted:', ''),
}))

import {
  exchangeCliDeviceCode,
  hashCliUserCode,
  normalizeUserCode,
} from '@/lib/cli/device-auth'

function authorization(overrides: Record<string, unknown> = {}) {
  return {
    id: 'authorization-1',
    status: 'PENDING',
    intervalSeconds: 5,
    lastPolledAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    encryptedCredential: null,
    ...overrides,
  }
}

describe('CLI device authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.authorization = authorization()
  })

  it('normalizes human-entered codes before hashing', () => {
    expect(normalizeUserCode('abcd-efgh')).toBe('ABCDEFGH')
    expect(hashCliUserCode('ABCD-EFGH')).toBe(hashCliUserCode('abcd efgh'))
  })

  it('keeps pending authorization pending and enforces the poll interval', async () => {
    expect(await exchangeCliDeviceCode('device-code')).toEqual({
      ok: false,
      code: 'AUTHORIZATION_PENDING',
    })
    const second = await exchangeCliDeviceCode('device-code')
    expect(second).toEqual({ ok: false, code: 'SLOW_DOWN', retryAfter: 5 })
  })

  it('rejects denied and expired requests', async () => {
    state.authorization = authorization({ status: 'DENIED' })
    expect(await exchangeCliDeviceCode('device-code')).toEqual({
      ok: false,
      code: 'ACCESS_DENIED',
    })
    state.authorization = authorization({
      expiresAt: new Date(Date.now() - 1),
    })
    expect(await exchangeCliDeviceCode('device-code')).toEqual({
      ok: false,
      code: 'EXPIRED_DEVICE_CODE',
    })
  })

  it('revokes an approved credential that expires before it is collected', async () => {
    state.authorization = authorization({
      status: 'APPROVED',
      apiKeyId: 'key-1',
      encryptedCredential: 'encrypted:ff_live_uncollected',
      expiresAt: new Date(Date.now() - 1),
    })
    expect(await exchangeCliDeviceCode('device-code')).toEqual({
      ok: false,
      code: 'EXPIRED_DEVICE_CODE',
    })
    expect(prisma.apiKey.updateMany).toHaveBeenCalledWith({
      where: { id: 'key-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
    expect(state.authorization.encryptedCredential).toBeNull()
  })

  it('returns an approved credential once and consumes it', async () => {
    state.authorization = authorization({
      status: 'APPROVED',
      encryptedCredential: 'encrypted:ff_live_once',
    })
    expect(await exchangeCliDeviceCode('device-code')).toEqual({
      ok: true,
      accessToken: 'ff_live_once',
      tokenType: 'Bearer',
    })
    expect(state.authorization.status).toBe('CONSUMED')
    expect(state.authorization.encryptedCredential).toBeNull()
    state.authorization.lastPolledAt = null
    expect(await exchangeCliDeviceCode('device-code')).toEqual({
      ok: false,
      code: 'DEVICE_CODE_ALREADY_USED',
    })
  })
})
