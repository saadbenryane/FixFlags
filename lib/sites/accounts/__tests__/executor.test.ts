import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flowFingerprint } from '../identity'
const mocks = vi.hoisted(() => ({ permission: vi.fn(), reserve: vi.fn(), open: vi.fn(), links: vi.fn(), form: vi.fn(),
  authenticated: vi.fn(), fill: vi.fn(), submit: vi.fn(), find: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), close: vi.fn(), mutation: vi.fn() }))
vi.mock('../store', () => ({ assertAccountPermission: mocks.permission, reserveAccount: mocks.reserve }))
vi.mock('@/lib/db', () => ({ prisma: { siteTestAccount: { findUnique: mocks.find, findMany: mocks.findMany, update: mocks.update }, siteAccountMessage: { findFirst: vi.fn() } } }))
vi.mock('@/lib/audit/execution-ownership', () => ({ executionTransaction: (run: (tx: unknown) => unknown) => run({ siteTestAccount: { updateMany: mocks.updateMany } }),
  executionWrite: (run: (tx: unknown) => unknown) => run({ siteTestAccount: { update: mocks.update }, siteAccountMessage: { deleteMany: vi.fn() } }) }))
vi.mock('@/lib/security/crypto', () => ({ encryptSecret: () => 'encrypted-session', decryptSecret: (value: string) => value === 'password' ? 'test-password' : '{"cookies":[],"origins":[]}' }))
vi.mock('@axe-core/playwright', () => ({ default: class { withTags() { return this } async analyze() { return { violations: [] } } } }))
vi.mock('../browser', () => ({ openAccountBrowser: mocks.open, accountLinks: mocks.links, authenticated: mocks.authenticated,
  scopedSessionState: (value: unknown) => value, readAccountForm: mocks.form, fillAccountForm: mocks.fill, formSubmit: mocks.submit, explicitAuthError: vi.fn().mockResolvedValue(false) }))
import { executeAccountChecks } from '../executor'
const form = { url: 'https://example.com/signup', action: 'https://example.com/api/signup', formIndex: 0,
  fields: [{ type: 'email', name: 'email', label: 'Email', autocomplete: 'email', required: true, index: 0 },
    { type: 'password', name: 'password', label: 'Password', autocomplete: 'new-password', required: true, index: 1 }] }
const retained = { id: 'retained', purpose: 'retained', state: 'ACTIVE', email: 'checks+retained@example.com', projectId: 'project', origin: 'https://example.com',
  encryptedPassword: 'password', encryptedSession: 'session', signupUrl: form.url, loginUrl: 'https://example.com/login', homeUrl: 'https://example.com/dashboard', flowFingerprint: flowFingerprint(form) }
const input = { projectId: 'project', auditId: 'audit', intent: { revision: 1, mode: 'routine' as const }, targetUrl: 'https://example.com', deadline: Date.now() + 180_000 }
beforeEach(() => {
  vi.clearAllMocks(); mocks.permission.mockResolvedValue(undefined); mocks.reserve.mockResolvedValue(retained)
  mocks.authenticated.mockResolvedValue(true); mocks.form.mockResolvedValue(form); mocks.fill.mockResolvedValue(true); mocks.submit.mockResolvedValue(true)
  const locator = { count: async () => 0, first: () => locator, nth: () => locator, isVisible: async () => false, waitFor: async () => undefined,
    or: () => locator }
  const page = { url: () => retained.homeUrl, goto: vi.fn().mockResolvedValue({ status: () => 200 }), waitForTimeout: vi.fn().mockResolvedValue(undefined),
    getByRole: () => locator, locator: () => locator, context: () => ({ storageState: async () => ({ cookies: [], origins: [] }) }) }
  mocks.open.mockResolvedValue({ session: { page, consoleErrors: [] }, mutation: mocks.mutation, closed: mocks.close, refused: () => false })
  mocks.links.mockImplementation((_page, _origin, pattern) => Promise.resolve(pattern === 'log.?in|sign.?in' ? [retained.loginUrl] : pattern === 'sign.?up|register|registration|create.?account' ? [form.url] : pattern === '.' ? [retained.homeUrl] : []))
  mocks.find.mockResolvedValue({ ...retained, id: 'disposable', purpose: 'disposable', state: 'DELETED' })
  mocks.updateMany.mockResolvedValue({ count: 1 })
})
describe('reusable signed-in monitoring', () => {
  it('cancels an unsubmitted reservation without creating an account to delete', async () => {
    const account = { ...retained, state: 'RESERVED', submittedAt: null }
    mocks.findMany.mockResolvedValue([account])
    const result = await executeAccountChecks({ ...input, intent: { revision: 1, mode: 'cleanup' } })
    expect(result.observations).toEqual([expect.objectContaining({ kind: 'deletion', state: 'verified',
      evidence: { signupSubmitted: false, cleanup: 'reservation-canceled' } })])
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: account.id, email: account.email, state: 'RESERVED', submittedAt: null },
      data: { state: 'DELETED', encryptedSession: null, deletionVerifiedAt: null } })
    expect(mocks.open).not.toHaveBeenCalled(); expect(mocks.reserve).not.toHaveBeenCalled(); expect(mocks.submit).not.toHaveBeenCalled()
    mocks.updateMany.mockResolvedValue({ count: 0 })
    expect((await executeAccountChecks({ ...input, intent: { revision: 1, mode: 'cleanup' } })).observations)
      .toContainEqual(expect.objectContaining({ state: 'unknown' }))
  })
  it('reuses the retained identity and creates no signup on unchanged routine checks', async () => {
    const result = await executeAccountChecks(input)
    expect(result.observations).toEqual([expect.objectContaining({ kind: 'signed_in', state: 'verified', evidence: expect.objectContaining({ context: 'signed-in' }) })])
    expect(mocks.reserve).toHaveBeenCalledTimes(1); expect(mocks.submit).not.toHaveBeenCalled()
    expect(mocks.mutation).not.toHaveBeenCalledWith('signup', expect.anything())
    expect(mocks.close).toHaveBeenCalledTimes(2)
  })
  it('recovers an expired session through login without creating another signup', async () => {
    mocks.authenticated.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValue(true)
    await executeAccountChecks(input)
    expect(mocks.mutation).toHaveBeenCalledWith('login', form.action)
    expect(mocks.reserve).toHaveBeenCalledTimes(1)
    expect(mocks.mutation).not.toHaveBeenCalledWith('signup', expect.anything())
  })
  it('does not replace an unresolved disposable account when retesting is requested', async () => {
    mocks.find.mockResolvedValue({ ...retained, purpose: 'disposable', id: 'disposable', state: 'ACTIVE' })
    const result = await executeAccountChecks({ ...input, intent: { revision: 1, mode: 'retest' } })
    expect(mocks.reserve).toHaveBeenCalledTimes(1)
    expect(result.observations).toContainEqual(expect.objectContaining({ kind: 'deletion', state: 'unavailable' }))
    expect(mocks.mutation).not.toHaveBeenCalledWith('signup', expect.anything())
  })
  it('rechecks permission before any browser session is opened', async () => {
    mocks.permission.mockRejectedValueOnce(new Error('paused'))
    await expect(executeAccountChecks(input)).rejects.toThrow('paused')
    expect(mocks.open).not.toHaveBeenCalled(); expect(mocks.reserve).not.toHaveBeenCalled()
  })
})
