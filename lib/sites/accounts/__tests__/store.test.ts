import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { reserveAccount, accountAdmission, assertAccountPermission } from '../store'
const db = vi.hoisted(() => ({ lock: vi.fn(), project: vi.fn(), existing: vi.fn(), create: vi.fn(), update: vi.fn(), messages: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { project: { findFirst: db.project } } }))
vi.mock('@/lib/audit/execution-ownership', () => ({ executionTransaction: (run: (tx: unknown) => unknown) => run({
  $queryRaw: db.lock, project: { findFirst: db.project }, siteTestAccount: { findUnique: db.existing, create: db.create, update: db.update }, siteAccountMessage: { deleteMany: db.messages },
}) }))
vi.mock('@/lib/security/crypto', () => ({ encryptSecret: (value: string) => 'encrypted:' + value }))
vi.mock('@/lib/billing/beta-policy', () => ({ hasOpenBetaAccess: () => false }))
const input = { projectId: 'p1', origin: 'https://example.com', purpose: 'disposable' as const, signupUrl: 'https://example.com/signup', loginUrl: 'https://example.com/login', fingerprint: 'flow', intent: { revision: 1, mode: 'routine' as const } }
beforeEach(() => {
  vi.clearAllMocks()
  for (const [key, value] of Object.entries({ ACCOUNT_CHECKS_ENABLED: 'true', ACCOUNT_CHECKS_LIFECYCLE_VERIFIED: 'true', ACCOUNT_TEST_EMAIL: 'checks@example.com',
    TOKEN_ENCRYPTION_KEY: 'a'.repeat(64), RESEND_API_KEY: 'test-key', RESEND_RECEIVING_WEBHOOK_SECRET: 'test-secret' })) vi.stubEnv(key, value)
  db.project.mockResolvedValue({ user: { role: 'user', plan: 'BUILDER', subscriptionStatus: 'ACTIVE' } })
})
afterEach(() => vi.unstubAllEnvs())
describe('durable account reservation', () => {
  it('permits cleanup after opt-out, a canceled entitlement and paused new-check infrastructure', async () => {
    const project = { url: input.origin, accountChecksEnabled: false, accountCheckRevision: 3,
      user: { role: 'user', plan: 'BUILDER', subscriptionStatus: 'CANCELED' } }
    db.project.mockResolvedValue(project)
    vi.stubEnv('ACCOUNT_CHECKS_ENABLED', 'false'); vi.stubEnv('ACCOUNT_CHECKS_LIFECYCLE_VERIFIED', 'false')
    await expect(accountAdmission('p1', 'cleanup')).resolves.toEqual({ revision: 3, mode: 'cleanup', siteUrl: input.origin })
    await expect(accountAdmission('p1', 'routine')).resolves.toBeUndefined()
    const tx = { project: { findFirst: db.project } }
    await expect(assertAccountPermission('p1', { revision: 3, mode: 'cleanup' }, tx as never)).resolves.toBeUndefined()
    expect(db.project).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: 'p1', deletedAt: null, accountCheckRevision: 3 } }))
    await expect(assertAccountPermission('p1', { revision: 3, mode: 'routine' }, tx as never)).rejects.toThrow('paused or unavailable')
    await expect(reserveAccount({ ...input, intent: { revision: 3, mode: 'cleanup' } })).rejects.toThrow('cannot reserve')
    expect(db.create).not.toHaveBeenCalled()
  })
  it('still denies cleanup without the owning Site, exact revision or encryption key', async () => {
    db.project.mockResolvedValue(null)
    const tx = { project: { findFirst: db.project } }
    await expect(assertAccountPermission('p1', { revision: 3, mode: 'cleanup' }, tx as never)).rejects.toThrow('paused or unavailable')
    db.project.mockResolvedValue({ user: { role: 'user', plan: 'BUILDER', subscriptionStatus: 'CANCELED' } })
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', '')
    await expect(assertAccountPermission('p1', { revision: 3, mode: 'cleanup' }, tx as never)).rejects.toThrow('paused or unavailable')
  })
  it('reuses unresolved identities without generating another account', async () => {
    const account = { id: 'a1', state: 'SUBMITTING', email: 'reserved@example.com' }; db.existing.mockResolvedValue(account)
    expect(await reserveAccount({ ...input, replaceDeleted: true })).toBe(account)
    expect(db.lock).toHaveBeenCalled(); expect(db.create).not.toHaveBeenCalled(); expect(db.update).not.toHaveBeenCalled()
  })
  it('replaces only a deleted disposable slot and clears its old messages', async () => {
    db.existing.mockResolvedValue({ id: 'a1', state: 'DELETED' }); db.update.mockResolvedValue({ id: 'a1', state: 'RESERVED' })
    await reserveAccount({ ...input, replaceDeleted: true })
    expect(db.messages).toHaveBeenCalledWith({ where: { accountId: 'a1' } })
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: 'RESERVED', submittedAt: null, encryptedSession: null }) }))
  })
  it('never replaces the retained account during routine work', async () => {
    const retained = { id: 'retained', state: 'DELETED' }; db.existing.mockResolvedValue(retained)
    expect(await reserveAccount({ ...input, purpose: 'retained', replaceDeleted: true })).toBe(retained)
    expect(db.create).not.toHaveBeenCalled(); expect(db.update).not.toHaveBeenCalled()
  })
  it('rechecks opt-out and revision inside the reservation transaction', async () => {
    db.project.mockResolvedValue(null)
    await expect(reserveAccount(input)).rejects.toThrow('paused or unavailable')
    expect(db.existing).not.toHaveBeenCalled(); expect(db.create).not.toHaveBeenCalled()
  })
})
