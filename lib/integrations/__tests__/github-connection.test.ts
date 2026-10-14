import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), lock: vi.fn(), user: vi.fn(), upsert: vi.fn(), find: vi.fn(), remove: vi.fn(), pending: vi.fn(), exchange: vi.fn(), identity: vi.fn(), revoke: vi.fn(), decrypt: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { $transaction: mocks.transaction } }))
vi.mock('@/lib/auth/entitlements', () => ({ canScanRepositories: () => true }))
vi.mock('@/lib/integrations/github', () => ({ exchangeCodeForGithubToken: mocks.exchange, fetchGithubUser: mocks.identity, revokeGithubGrant: mocks.revoke }))
vi.mock('@/lib/security/crypto', () => ({ decryptSecret: mocks.decrypt, encryptSecret: () => 'encrypted-token' }))
vi.mock('@/lib/queue/client', () => ({ getAuditQueue: () => ({ remove: vi.fn() }) }))
import { saveGithubAuthorization, disconnectGithubAuthorization } from '../github-connection'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(fn => fn({ $queryRaw: mocks.lock, user: { findUnique: mocks.user }, githubConnection: { findUnique: mocks.find, upsert: mocks.upsert, delete: mocks.remove }, repoFixPr: { findMany: mocks.pending } }))
  mocks.lock.mockResolvedValue([{ id: 'owner' }]); mocks.user.mockResolvedValue({ id: 'owner' })
  mocks.exchange.mockResolvedValue({ accessToken: 'synthetic-token', scope: 'repo' }); mocks.identity.mockResolvedValue({ id: 42, login: 'synthetic-owner' })
  mocks.pending.mockResolvedValue([]); mocks.decrypt.mockReturnValue('synthetic-token')
})
it('serializes authorization against account cleanup before contacting the provider', async () => {
  await saveGithubAuthorization('owner', 'code')
  expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.exchange.mock.invocationCallOrder[0])
  expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner' }, create: expect.objectContaining({ encryptedAccessToken: 'encrypted-token', selectedRepos: [] }) }))
  expect(JSON.stringify(mocks.upsert.mock.calls)).not.toContain('synthetic-token')
})
it('does not exchange authorization or write after account removal', async () => {
  mocks.lock.mockResolvedValue([])
  await expect(saveGithubAuthorization('owner', 'code')).rejects.toMatchObject({ status: 404 })
  expect(mocks.exchange).not.toHaveBeenCalled(); expect(mocks.upsert).not.toHaveBeenCalled()
})
it('keeps disconnect idempotent without fabricating provider revocation', async () => {
  mocks.find.mockResolvedValue(null)
  expect(await disconnectGithubAuthorization('owner')).toEqual({ ok: true, revocation: 'not_needed' })
  expect(mocks.revoke).not.toHaveBeenCalled()
})
it('removes an unreadable local token and explicitly acknowledges unavailable external cleanup', async () => {
  mocks.find.mockResolvedValue({ id: 'connection', encryptedAccessToken: 'encrypted' }); mocks.decrypt.mockImplementation(() => { throw new Error('Unreadable token') })
  expect(await disconnectGithubAuthorization('owner')).toEqual({ ok: true, revocation: 'unconfirmed' })
  expect(mocks.remove).toHaveBeenCalledWith({ where: { id: 'connection' } })
})
