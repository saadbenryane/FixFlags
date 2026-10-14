import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), configured: vi.fn(), state: vi.fn(), read: vi.fn(), save: vi.fn(), disconnect: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }))
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: mocks.user } } }))
vi.mock('@/lib/auth/entitlements', () => ({ canScanRepositories: () => true }))
vi.mock('@/lib/security/rate-limit', () => ({ enforceRateLimit: async () => {}, requestClientId: () => 'controlled' }))
vi.mock('@/lib/integrations/github', () => ({ isGithubRepoAccessConfigured: mocks.configured, signGithubConnectState: mocks.state,
  readGithubConnectState: mocks.read, buildGithubAuthorizeUrl: () => 'https://github.com/login/oauth/authorize?state=signed' }))
vi.mock('@/lib/integrations/github-connection', () => ({ saveGithubAuthorization: mocks.save, disconnectGithubAuthorization: mocks.disconnect }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
import { GET as connect } from '../route'
import { GET as callback } from '../../callback/route'
import { POST as disconnect } from '../../disconnect/route'
const siteDestination = '/sites/owned-site?view=integrations'
const destination = '/settings/integrations?next=' + encodeURIComponent(siteDestination)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue({ user: { id: 'owner' } }); mocks.user.mockResolvedValue({ id: 'owner' })
  mocks.configured.mockReturnValue(true); mocks.state.mockReturnValue('signed')
  mocks.read.mockReturnValue({ destination }); mocks.save.mockResolvedValue(undefined)
  mocks.disconnect.mockResolvedValue({ ok: true, revocation: 'confirmed' })
})
it('continues anonymous authorization through the exact Site integration destination', async () => {
  mocks.session.mockResolvedValue(null)
  const response = await connect(new NextRequest('https://fixflags.com/api/integrations/github/connect?next=' + encodeURIComponent(siteDestination)))
  const location = new URL(response.headers.get('location')!)
  expect(location.pathname).toBe('/sign-in'); expect(location.searchParams.get('next')).toBe(destination)
  expect(mocks.state).not.toHaveBeenCalled()
})
it('signs the authenticated owner and destination before provider authorization', async () => {
  const response = await connect(new NextRequest('https://fixflags.com/api/integrations/github/connect?next=' + encodeURIComponent(siteDestination)))
  expect(mocks.state).toHaveBeenCalledWith('owner', destination)
  expect(new URL(response.headers.get('location')!).hostname).toBe('github.com')
})
it('offers a setup limitation without fabricating an authorization when credentials are absent', async () => {
  mocks.configured.mockReturnValue(false)
  const response = await connect(new NextRequest('https://fixflags.com/api/integrations/github/connect'))
  expect(new URL(response.headers.get('location')!).searchParams.get('error')).toBe('not_configured')
  expect(mocks.state).not.toHaveBeenCalled()
})
it('rejects a foreign or expired callback state before exchanging a code', async () => {
  mocks.read.mockReturnValue(null)
  const response = await callback(new NextRequest('https://fixflags.com/api/integrations/github/callback?state=foreign&code=code'))
  expect(new URL(response.headers.get('location')!).searchParams.get('error')).toBe('invalid_state')
  expect(mocks.save).not.toHaveBeenCalled()
})
it('returns a verified callback to the same Site after saving authorization', async () => {
  const response = await callback(new NextRequest('https://fixflags.com/api/integrations/github/callback?state=signed&code=code'))
  expect(mocks.save).toHaveBeenCalledWith('owner', 'code')
  const location = new URL(response.headers.get('location')!)
  expect(location.pathname).toBe('/settings/integrations'); expect(location.searchParams.get('next')).toBe(siteDestination); expect(location.searchParams.get('connected')).toBe('1')
})
it('requires a session before revoking authorization', async () => {
  mocks.session.mockResolvedValue(null)
  expect((await disconnect()).status).toBe(401); expect(mocks.disconnect).not.toHaveBeenCalled()
})
it('reports the cleanup command result for the authenticated owner', async () => {
  expect(await (await disconnect()).json()).toEqual({ ok: true, revocation: 'confirmed' })
  expect(mocks.disconnect).toHaveBeenCalledWith('owner')
})
