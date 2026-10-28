import { beforeEach, describe, expect, it, vi } from 'vitest'

const integrationRelease = vi.hoisted(() => vi.fn(() => 'available'))
vi.mock('@/lib/integrations/release-policy', () => ({ integrationRelease }))
const mocks = vi.hoisted(() => ({ session: vi.fn(), access: vi.fn(), connection: vi.fn(), update: vi.fn(), token: vi.fn(), revoke: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteAccess: mocks.access }))
vi.mock('@/lib/db', () => ({ prisma: { siteConnection: { findUnique: mocks.connection, updateMany: mocks.update } } }))
vi.mock('@/lib/security/crypto', () => ({ decryptSecret: () => 'fixture-revocation-token' }))
vi.mock('@/lib/sites/connections/google', async importOriginal => ({
  ...await importOriginal<object>(), googleConnectionConfigured: () => true,
  accessTokenForConnection: mocks.token, liveGoogleClient: () => ({ revoke: mocks.revoke }),
}))

import { DELETE, POST } from '../route'
import { GoogleProviderError } from '@/lib/integrations/google-response'

const connection = { id: 'connection-1', projectId: 'project-1', authorizedByUserId: 'owner', provider: 'ANALYTICS', status: 'CONNECTED',
  encryptedAccessToken: 'fixture-encrypted-access', encryptedRefreshToken: 'fixture-encrypted-refresh', tokenExpiresAt: new Date(0) }
const context = { params: Promise.resolve({ siteId: 'project-1' }) }
const request = (method: string, action?: string) => new Request('http://localhost/api/sites/project-1/connections/google', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'ANALYTICS', ...(action ? { action } : {}) }),
})

it('does not sync or revoke the former owner\'s retained grant for the current Site owner', async () => {
  mocks.connection.mockResolvedValue({ ...connection, authorizedByUserId: 'former-owner' })
  expect((await POST(request('POST', 'sync'), context)).status).toBe(409)
  expect((await DELETE(request('DELETE'), context)).status).toBe(200)
  expect(mocks.token).not.toHaveBeenCalled()
  expect(mocks.update).not.toHaveBeenCalled()
  expect(mocks.revoke).not.toHaveBeenCalled()
})

beforeEach(() => {
  vi.resetAllMocks()
  integrationRelease.mockReturnValue('available')
  mocks.session.mockResolvedValue({ user: { id: 'owner' } })
  mocks.access.mockResolvedValue({ ok: true, decision: { role: 'owner', site: {
    projectId: 'project-1', userId: 'owner', canonicalHost: 'example.com', url: 'https://example.com/',
  } } })
  mocks.connection.mockResolvedValue(connection)
  mocks.update.mockResolvedValue({ count: 1 })
  mocks.token.mockResolvedValue(null)
  mocks.revoke.mockResolvedValue(undefined)
})

describe('Google connection action ownership', () => {
  it.each(['PROVIDER_UNAVAILABLE', 'PROVIDER_QUOTA', 'MALFORMED_PROVIDER_RESPONSE'] as const)('does not revoke permission when refresh reports %s', async code => {
    mocks.token.mockRejectedValue(new GoogleProviderError(code, 13_100))
    const response = await POST(request('POST', 'sync'), context)
    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('14')
    expect(await response.json()).toMatchObject({ code, action: 'retry' })
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it.each(['AUTH_EXPIRED', 'PERMISSION_REFUSED'] as const)('requires reconnection only after explicit %s refusal', async code => {
    mocks.token.mockRejectedValue(new GoogleProviderError(code))
    expect((await POST(request('POST', 'sync'), context)).status).toBe(401)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      project: expect.objectContaining({ userId: 'owner' }),
    }), data: expect.objectContaining({ status: 'NEEDS_REAUTH' }) }))
  })
  it('keeps permission after an unclassified transport interruption', async () => {
    mocks.token.mockRejectedValue(new Error('Authorization service transport failed'))
    expect((await POST(request('POST', 'sync'), context)).status).toBe(503)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('refuses new setup and refresh while the integration is coming soon', async () => {
    integrationRelease.mockReturnValue('planned')
    const response = await POST(request('POST', 'sync'), context)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'INTEGRATION_COMING_SOON' })
    expect(mocks.token).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('does not change a revoked or replaced connection to needs reauthentication after a stale token read', async () => {
    mocks.update.mockResolvedValue({ count: 0 })
    const response = await POST(request('POST', 'sync'), context)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ message: 'This connection changed. Try again from Integrations.' })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      id: connection.id, status: { not: 'REVOKED' }, encryptedAccessToken: connection.encryptedAccessToken,
      encryptedRefreshToken: connection.encryptedRefreshToken, tokenExpiresAt: connection.tokenExpiresAt,
    }) }))
  })

  it('clears local credentials before waiting for Google revocation', async () => {
    let finish!: () => void
    mocks.revoke.mockReturnValue(new Promise<void>(resolve => { finish = resolve }))
    const disconnecting = DELETE(request('DELETE'), context)
    try {
      await vi.waitFor(() => expect(mocks.revoke).toHaveBeenCalledOnce())
      expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'REVOKED', encryptedAccessToken: null, encryptedRefreshToken: null, tokenExpiresAt: null }),
      }))
    } finally {
      finish()
    }
    expect((await disconnecting).status).toBe(200)
  })

  it('does not revoke credentials belonging to a concurrently replaced connection', async () => {
    mocks.update.mockResolvedValue({ count: 0 })
    expect((await DELETE(request('DELETE'), context)).status).toBe(409)
    expect(mocks.revoke).not.toHaveBeenCalled()
  })

  it('keeps repeated disconnects idempotent', async () => {
    mocks.connection.mockResolvedValue({ ...connection, status: 'REVOKED', encryptedAccessToken: null, encryptedRefreshToken: null, tokenExpiresAt: null })
    expect((await DELETE(request('DELETE'), context)).status).toBe(200)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.revoke).not.toHaveBeenCalled()
  })

  it('refuses a foreign owner before reading or changing credentials', async () => {
    mocks.access.mockResolvedValue({ ok: true, decision: { role: 'owner', site: { projectId: 'project-1', userId: 'foreign' } } })
    expect((await DELETE(request('DELETE'), context)).status).toBe(404)
    expect(mocks.connection).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
