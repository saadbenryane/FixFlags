import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { gscConnection: mocks } }))
vi.mock('@/lib/security/crypto', () => ({
  decryptSecret: (value: string) => value.replace('encrypted:', ''),
  encryptSecret: (value: string) => `encrypted:${value}`,
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
import { getGscAccessToken } from '../google-search-console'

describe('GSC credential lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('uses the access token, never the refresh token, before expiry', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'connection', accessToken: 'encrypted:access', refreshToken: 'encrypted:refresh', tokenExpiry: new Date(Date.now() + 3_600_000) })
    expect(await getGscAccessToken('owner')).toBe('access')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('persists refreshed credentials for the next request', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'connection', accessToken: 'encrypted:expired', refreshToken: 'encrypted:refresh', tokenExpiry: new Date(0) })
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ access_token: 'new-access', expires_in: 3600 })))
    expect(await getGscAccessToken('owner')).toBe('new-access')
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'connection' }, data: { accessToken: 'encrypted:new-access', tokenExpiry: expect.any(Date) } })
  })

  it('does not return stale credentials after a rejected refresh', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'connection', accessToken: 'encrypted:expired', refreshToken: 'encrypted:refresh', tokenExpiry: new Date(0) })
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 401 }))
    expect(await getGscAccessToken('owner')).toBeNull()
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
