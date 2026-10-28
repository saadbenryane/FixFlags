import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PAGE } from './fixtures'
const stubs = vi.hoisted(() => ({
  audit: vi.fn(), connection: vi.fn(), legacy: vi.fn(), update: vi.fn(), token: vi.fn(),
  inspect: vi.fn(), analytics: vi.fn(), legacyToken: vi.fn(), persisted: new Map<string, unknown>(), createRows: vi.fn(),
}))
vi.mock('@/lib/sites/connections/google', async importOriginal => ({ ...await importOriginal<object>(), accessTokenForConnection: stubs.token }))
vi.mock('@/lib/integrations/google-search-console', async importOriginal => ({
  ...await importOriginal<object>(), inspectSearchUrl: stubs.inspect, querySearchAnalytics: stubs.analytics,
  getGscAccess: async (userId: string) => {
    const token = await stubs.legacyToken(userId)
    return token ? { token, grant: await stubs.legacy() } : null
  },
}))
vi.mock('@/lib/audit/search/workflow', () => ({ recordSearchVerifiers: vi.fn() }))
vi.mock('@/lib/db', () => {
  const ledger = {
    findUnique: vi.fn(async ({ where }) => {
      const key = where.auditId_targetKey_scopeKey
      const detail = stubs.persisted.get(key.auditId + key.scopeKey)
      return detail ? { detail } : null
    }),
    upsert: vi.fn(async ({ create }) => { stubs.persisted.set(create.auditId + create.scopeKey, create.detail); return create }),
  }
  const tx = { $executeRaw: vi.fn(), auditVerifierExecution: ledger,
    $queryRaw: vi.fn(async () => []), project: { findFirst: vi.fn(async () => ({ id: 'site' })) },
    siteConnection: { findUnique: stubs.connection, findFirst: vi.fn(async () => ({ id: 'connection' })), updateMany: stubs.update },
    gscConnection: { findUnique: stubs.legacy, findFirst: stubs.legacy },
    indexStatus: { upsert: vi.fn() }, searchPerformance: { createMany: stubs.createRows } }
  return { prisma: { ...tx, audit: { findFirst: stubs.audit },
    $transaction: async (callback: (db: unknown) => unknown) => callback(tx) } }
})
import { runGoogleSearchForAudit } from '../google'
import { SearchConsoleError } from '@/lib/integrations/google-search-console'
import { prisma } from '@/lib/db'
beforeEach(() => {
  vi.clearAllMocks(); stubs.persisted.clear()
  stubs.audit.mockResolvedValue({ id: 'audit', projectId: 'site', parentId: null, userId: 'owner', project: { userId: 'owner' } })
  stubs.connection.mockResolvedValue({ id: 'connection', authorizedByUserId: 'owner', status: 'CONNECTED', propertyId: 'https://example.com/',
    encryptedAccessToken: 'fixture-encrypted-access', encryptedRefreshToken: 'fixture-encrypted-grant', tokenExpiresAt: null })
  stubs.token.mockResolvedValue('test-access')
  stubs.legacy.mockResolvedValue(null)
  stubs.legacyToken.mockResolvedValue('fixture-legacy-access')
  stubs.inspect.mockResolvedValue({ indexStatusResult: { verdict: 'PASS', lastCrawlTime: '2026-10-01T00:00:00Z' },
    richResultsResult: { verdict: 'PASS', detectedItems: [{ richResultType: 'Product' }] } })
  stubs.analytics.mockResolvedValue([{ keys: ['product', PAGE, 'DESKTOP', 'USA'], clicks: 1, impressions: 500, ctr: 0.002, position: 3 }])
})
const run = (pages = [PAGE]) => runGoogleSearchForAudit({ auditId: 'audit', userId: 'owner', pages: pages.map(url => ({ url })), deadline: Date.now() + 10_000 })
describe('owner-scoped Google evidence', () => {
  it.each([null, 'former-owner'])('refuses a retained grant authorized by %s without borrowing legacy access', async authorizedByUserId => {
    stubs.connection.mockResolvedValue({ authorizedByUserId, status: 'CONNECTED', propertyId: 'https://example.com/' })
    const result = await run()
    expect(result.receipts[0].observations).toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'NOT_CONNECTED' })]))
    expect(stubs.token).not.toHaveBeenCalled()
    expect(stubs.legacyToken).not.toHaveBeenCalled()
    expect(stubs.inspect).not.toHaveBeenCalled()
    expect(stubs.analytics).not.toHaveBeenCalled()
  })
  it('does not require or refresh an account legacy property belonging to another website', async () => {
    stubs.connection.mockResolvedValue(null)
    stubs.legacy.mockResolvedValue({ siteUrl: 'https://unrelated.example/' })
    await run()
    expect(stubs.legacyToken).not.toHaveBeenCalled()
    expect(stubs.inspect).not.toHaveBeenCalled()
    expect(prisma.auditVerifierExecution.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: 'NOT_APPLICABLE' }),
    }))
  })
  it.each([true, false])('applies legacy credentials only to their covered pages with a valid token: %s', async valid => {
    stubs.connection.mockResolvedValue(null)
    stubs.legacy.mockResolvedValue({ siteUrl: PAGE + 'private/' })
    stubs.legacyToken.mockResolvedValue(valid ? 'fixture-legacy-access' : null)
    const result = await runGoogleSearchForAudit({ auditId: 'audit', userId: 'owner', sections: ['index'],
      pages: [{ url: PAGE }, { url: PAGE + 'private/' }], deadline: Date.now() + 10_000 })
    expect(result.receipts[0].observations[0]).toMatchObject({ disposition: 'unknown', reason: 'NOT_CONNECTED' })
    const receipts = vi.mocked(prisma.auditVerifierExecution.upsert).mock.calls.map(([input]) => input.create)
    expect(receipts.map(receipt => [receipt.pageUrl, receipt.status])).toEqual([[PAGE, 'NOT_APPLICABLE'], [PAGE + 'private/', 'COMPLETED']])
    expect(stubs.inspect).toHaveBeenCalledTimes(valid ? 1 : 0)
    if (valid) expect(stubs.inspect.mock.calls[0][2]).toBe(PAGE + 'private/')
    else expect(result.receipts[1].observations[0].reason).toBe('AUTH_EXPIRED')
  })
  it('keeps anonymous URL-first checks independent of private provider configuration', async () => {
    stubs.audit.mockResolvedValue({ id: 'audit', projectId: null, parentId: null, userId: null, project: null })
    const result = await runGoogleSearchForAudit({ auditId: 'audit', userId: null, pages: [{ url: PAGE }], deadline: Date.now() + 10_000 })
    expect(result.receipts[0].complete).toBe(false)
    expect(stubs.connection).not.toHaveBeenCalled()
    expect(stubs.legacy).not.toHaveBeenCalled()
    expect(stubs.inspect).not.toHaveBeenCalled()
    expect(prisma.auditVerifierExecution.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: 'NOT_APPLICABLE' }),
    }))
  })
  it('retains unknown observations without making an unconfigured property a public-check prerequisite', async () => {
    stubs.connection.mockResolvedValue(null)
    const result = await run()
    expect(result.receipts[0]).toMatchObject({ complete: false,
      observations: expect.arrayContaining([expect.objectContaining({ disposition: 'unknown', reason: 'NOT_CONNECTED' })]) })
    expect(prisma.auditVerifierExecution.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: 'NOT_APPLICABLE' }),
    }))
    expect(stubs.inspect).not.toHaveBeenCalled()
    expect(stubs.analytics).not.toHaveBeenCalled()
  })
  it('keeps an explicitly requested provider diagnosis incomplete when its configuration is absent', async () => {
    stubs.connection.mockResolvedValue(null)
    const result = await runGoogleSearchForAudit({ auditId: 'audit', userId: 'owner', pages: [{ url: PAGE }],
      deadline: Date.now() + 10_000, requireConfiguredEvidence: true })
    expect(result.receipts[0].complete).toBe(false)
    expect(prisma.auditVerifierExecution.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: 'COMPLETED' }),
    }))
    expect(stubs.inspect).not.toHaveBeenCalled()
  })
  it('rejects a cross-tenant execution before reading connection credentials', async () => {
    stubs.audit.mockResolvedValue(null)
    await expect(run()).rejects.toThrow('Site owner')
    expect(stubs.connection).not.toHaveBeenCalled()
    expect(stubs.token).not.toHaveBeenCalled()
  })
  it('does not use a wrong protocol/path property', async () => {
    stubs.connection.mockResolvedValue({ id: 'connection', authorizedByUserId: 'owner', status: 'CONNECTED', propertyId: 'http://example.com/private/' })
    const result = await run()
    expect(result.receipts[0].observations.every(item => item.reason === 'PROPERTY_MISMATCH')).toBe(true)
    expect(stubs.inspect).not.toHaveBeenCalled()
  })
  it('does not fall through a revoked Site connection to legacy access', async () => {
    stubs.connection.mockResolvedValue({ status: 'REVOKED', propertyId: 'https://example.com/' })
    const result = await run()
    expect(result.receipts[0].observations[0].reason).toBe('NOT_CONNECTED')
    expect(stubs.legacy).not.toHaveBeenCalled()
    expect(stubs.inspect).not.toHaveBeenCalled()
    expect(prisma.auditVerifierExecution.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: 'COMPLETED' }),
    }))
  })
  it('preserves indexed-version and rich-results sections, exact filtering, and advisory CTR', async () => {
    const result = await run()
    expect(result.receipts[0].observations.map(item => item.checkId)).toEqual([
      'search-google-index', 'indexing-failure', 'search-google-fetch', 'search-google-directives', 'search-google-canonical', 'search-google-rich-results', 'search-google-performance', 'low-ctr',
    ])
    expect(stubs.analytics.mock.calls[0][7]).toBe(PAGE)
    expect(result.findings.find(item => item.checkId === 'low-ctr')?.attentionPolicy?.kind).toBe('recommendation')
    expect(result.receipts[0].observations.find(item => item.checkId === 'indexing-failure')?.google?.lastCrawlAt).toBe('2026-10-01T00:00:00Z')
  })
  it('independently inspects Google when aggregate context is unavailable but the current credential is valid', async () => {
    const connection = await stubs.connection()
    stubs.connection.mockResolvedValue({ ...connection, status: 'UNAVAILABLE' })
    const result = await run()
    expect(stubs.inspect).toHaveBeenCalledOnce()
    expect(result.receipts[0].observations.find(item => item.checkId === 'indexing-failure')?.disposition).toBe('passed')
  })
  it('does not retry inspection with credentials that require reauthentication', async () => {
    const connection = await stubs.connection()
    stubs.connection.mockResolvedValue({ ...connection, status: 'NEEDS_REAUTH' })
    const result = await run()
    expect(stubs.inspect).not.toHaveBeenCalled()
    expect(stubs.token).not.toHaveBeenCalled()
    expect(result.receipts[0].observations[0].reason).toBe('AUTH_EXPIRED')
  })
  it('records quota refusal and stops repeatedly calling the provider', async () => {
    stubs.inspect.mockRejectedValue(new SearchConsoleError('PROVIDER_QUOTA'))
    stubs.analytics.mockRejectedValue(new SearchConsoleError('PROVIDER_QUOTA'))
    const result = await run([PAGE, PAGE + 'about'])
    expect(result.receipts.every(receipt => !receipt.complete)).toBe(true)
    expect(result.receipts[1].observations.every(item => item.reason === 'PROVIDER_QUOTA')).toBe(true)
    expect(stubs.inspect).toHaveBeenCalledTimes(1)
  })
  it('marks lost permission explicitly and requires reconnection', async () => {
    stubs.inspect.mockRejectedValue(new SearchConsoleError('PERMISSION_REFUSED'))
    const result = await run()
    expect(result.receipts[0].observations.some(item => item.reason === 'PERMISSION_REFUSED')).toBe(true)
    expect(stubs.update).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'connection', status: { in: ['CONNECTED', 'UNAVAILABLE'] },
        projectId: 'site', propertyId: 'https://example.com/', encryptedRefreshToken: 'fixture-encrypted-grant' }),
      data: expect.objectContaining({ status: 'NEEDS_REAUTH' }),
    }))
  })
  it('replays the originating receipt without duplicate provider requests or rows', async () => {
    const first = await run()
    stubs.inspect.mockResolvedValue({ indexStatusResult: { verdict: 'FAIL' } })
    expect(await run()).toEqual(first)
    expect(stubs.inspect).toHaveBeenCalledTimes(1)
    expect(stubs.createRows).toHaveBeenCalledTimes(1)
  })
})

