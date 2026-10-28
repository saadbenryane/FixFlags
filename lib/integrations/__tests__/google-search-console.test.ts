import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { gscConnection: mocks } }))
vi.mock('@/lib/security/crypto', () => ({
  decryptSecret: (value: string) => value.replace('encrypted:', ''),
  encryptSecret: (value: string) => `encrypted:${value}`,
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
import { getGscAccess, getGscAccessToken } from '../google-search-console'

describe('GSC credential lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    mocks.findFirst.mockResolvedValue({ id: 'connection' })
    mocks.updateMany.mockResolvedValue({ count: 1 })
  })

  it('uses the access token, never the refresh token, before expiry', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'connection', userId: 'owner', accessToken: 'encrypted:access', refreshToken: 'encrypted:refresh', tokenExpiry: new Date(Date.now() + 3_600_000) })
    expect(await getGscAccessToken('owner')).toBe('access')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('persists refreshed credentials for the next request', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'connection', userId: 'owner', accessToken: 'encrypted:expired', refreshToken: 'encrypted:refresh', tokenExpiry: new Date(0) })
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ access_token: 'new-access', expires_in: 3600 })))
    expect(await getGscAccessToken('owner')).toBe('new-access')
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: 'connection', userId: 'owner', accessToken: 'encrypted:expired',
      refreshToken: 'encrypted:refresh', tokenExpiry: new Date(0), user: { lifecycleStatus: 'ACTIVE' } },
    data: { accessToken: 'encrypted:new-access', tokenExpiry: expect.any(Date) } })
  })

  it('does not return stale credentials after a rejected refresh', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'connection', accessToken: 'encrypted:expired', refreshToken: 'encrypted:refresh', tokenExpiry: new Date(0) })
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 401 }))
    expect(await getGscAccessToken('owner')).toBeNull()
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })

  it('does not return a credential whose owner or grant changed before use', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'connection', userId: 'owner', accessToken: 'encrypted:access', refreshToken: 'encrypted:refresh', tokenExpiry: new Date(Date.now() + 3_600_000) })
    mocks.findFirst.mockResolvedValue(null)
    expect(await getGscAccessToken('owner')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns no token when the admitted credential no longer owns the refresh write', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'connection', userId: 'owner', accessToken: 'encrypted:expired', refreshToken: 'encrypted:refresh', tokenExpiry: new Date(0) })
    vi.mocked(fetch).mockResolvedValue(Response.json({ access_token: 'new-access', expires_in: 3600 }))
    mocks.updateMany.mockResolvedValue({ count: 0 })
    expect(await getGscAccessToken('owner')).toBeNull()
  })

  it('returns the exact refreshed grant with its token for later evidence fencing', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'connection', userId: 'owner', siteUrl: 'sc-domain:example.com', accessToken: 'encrypted:expired', refreshToken: 'encrypted:refresh', tokenExpiry: new Date(0) })
    vi.mocked(fetch).mockResolvedValue(Response.json({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 }))
    expect(await getGscAccess('owner')).toMatchObject({ token: 'new-access', grant: { id: 'connection', userId: 'owner',
      siteUrl: 'sc-domain:example.com', accessToken: 'encrypted:new-access', refreshToken: 'encrypted:new-refresh' } })
  })
})
