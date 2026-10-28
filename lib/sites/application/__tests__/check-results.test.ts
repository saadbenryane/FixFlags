import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SiteRecord } from '@/lib/sites/types'
const { findMany, findFirst, transaction, queryRaw } = vi.hoisted(() => ({ findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), transaction: vi.fn(), queryRaw: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/db', () => ({ prisma: {get auditExecutionTask() { return this.auditVerifierExecution }, get auditVerificationReceipt() { return this.auditVerifierExecution },  auditVerifierExecution: { findMany, findFirst }, $transaction: transaction } }))
import { loadSiteCheckResults, loadSiteCheckResultPage, CHECK_RESULT_PAGE_SIZE } from '../check-results'

describe('Site result access and provenance', () => {
  it('composes category receipts with the broad scope and dates superseded area evidence as history', async () => {
    const site = { projectId: 'site-1' } as SiteRecord
    const categories = new Map([['security', { id: 'category-1' }]]) as never
    const receipt = { targetKey: 'module:security', status: 'COMPLETED', detail: {},
      pageUrl: 'https://example.com', updatedAt: new Date('2026-10-12T12:00:00Z') }
    const rows = [{ ...receipt, id: 'new-security', auditId: 'category-1' },
      { ...receipt, id: 'old-security', auditId: 'latest' },
      { ...receipt, targetKey: 'module:metadata', id: 'current-metadata', auditId: 'latest' }]
    findMany.mockResolvedValueOnce(rows); findFirst.mockResolvedValueOnce({ id: 'old-security' })
    const current = await loadSiteCheckResultPage(site, 'latest', undefined, categories)
    expect(current.results.map(result => result.id)).toEqual(['new-security', 'current-metadata'])
    expect(current.results[0]).toMatchObject({ historical: false, auditId: 'category-1',
      evidenceReference: { auditId: 'category-1', executionId: 'new-security' } })
    findMany.mockResolvedValueOnce(rows.slice(1))
    const history = await loadSiteCheckResultPage(site, 'latest', current.nextCursor!, categories)
    expect(history.results).toMatchObject([{ id: 'old-security', historical: true, auditId: 'latest', checkedAt: receipt.updatedAt.toISOString() }])
    expect(history.results).toHaveLength(1)
    await expect(loadSiteCheckResultPage(site, 'latest', current.nextCursor!, new Map([['security', { id: 'category-2' }]]) as never))
      .rejects.toThrow('Invalid check history cursor')
  })
  beforeEach(() => { vi.clearAllMocks(); findMany.mockReset().mockResolvedValue([]); findFirst.mockReset().mockResolvedValue(null); queryRaw.mockReset().mockResolvedValue([])
    transaction.mockImplementation(operation => operation({get auditExecutionTask() { return this.auditVerifierExecution }, get auditVerificationReceipt() { return this.auditVerifierExecution },  auditVerifierExecution: { findMany, findFirst }, $queryRaw: queryRaw })) })
  it('never reads receipts by host or by a missing provisional identity', async () => {
    await loadSiteCheckResults({ projectId: 'site-1' } as SiteRecord, 'latest')
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ audit: { projectId: 'site-1' } }),
    }))
    findMany.mockClear()
    expect(await loadSiteCheckResults({ projectId: null, primaryAuditId: null } as SiteRecord, 'foreign')).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })
  it('retains the actual originating Audit and timestamp on prior completed evidence', async () => {
    findMany.mockResolvedValueOnce([{ id: 'receipt-1', auditId: 'previous', targetKey: 'module:metadata',
      status: 'COMPLETED', detail: {}, pageUrl: 'https://example.com', updatedAt: new Date('2026-10-01T12:00:00Z') }])
    const cursor = Buffer.from(JSON.stringify({ version: 1, phase: 'history', receiptId: null, offset: 0 })).toString('base64url')
    expect((await loadSiteCheckResultPage({ projectId: 'site-1' } as SiteRecord, 'latest', cursor)).results).toMatchObject([
      { auditId: 'previous', historical: true, checkedAt: '2026-10-01T12:00:00.000Z' },
    ])
  })
  it('bounds reads and rejects a cursor outside the authorized Site', async () => {
    const site = { projectId: 'site-1' } as SiteRecord
    await loadSiteCheckResultPage(site, 'latest')
    expect(CHECK_RESULT_PAGE_SIZE).toBe(100)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 11,
      orderBy: [{ audit: { createdAt: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }] }))
    await expect(loadSiteCheckResultPage(site, 'latest', 'foreign')).rejects.toThrow('Invalid check history cursor')
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'foreign', audit: { projectId: 'site-1' } }) }))
  })
  it('uses the lookahead receipt as the next cursor without duplicating the last displayed receipt', async () => {
    const rows = Array.from({ length: 11 }, (_, index) => ({ id: 'receipt-' + index, auditId: 'latest',
      targetKey: 'module:metadata', status: 'COMPLETED', detail: {}, pageUrl: 'https://example.com', updatedAt: new Date('2026-10-11') }))
    findMany.mockResolvedValueOnce(rows)
    const site = { projectId: 'site-1' } as SiteRecord
    const first = await loadSiteCheckResultPage(site, 'latest')
    expect(first.results.map(item => item.id)).toEqual(rows.slice(0, 10).map(item => item.id))
    findFirst.mockResolvedValueOnce({ id: 'receipt-10' })
    findMany.mockResolvedValueOnce([rows[10]])
    const second = await loadSiteCheckResultPage(site, 'latest', first.nextCursor!)
    expect(second.results.map(item => item.id)).toEqual(['receipt-10'])
  })
  it('keeps the latest failed result current and the older success historical', async () => {
    const base = { targetKey: 'module:metadata', detail: {}, pageUrl: 'https://example.com', updatedAt: new Date('2026-10-11') }
    findMany.mockResolvedValueOnce([{ ...base, id: 'new', auditId: 'latest', status: 'FAILED' }])
    findFirst.mockResolvedValueOnce({ id: 'old' })
    const current = await loadSiteCheckResultPage({ projectId: 'site-1' } as SiteRecord, 'latest')
    expect(current.results).toMatchObject([{ status: 'failed', historical: false }])
    expect(current.nextCursor).not.toBeNull()
    findMany.mockResolvedValueOnce([{ ...base, id: 'old', auditId: 'prior', status: 'COMPLETED' }])
    const history = await loadSiteCheckResultPage({ projectId: 'site-1' } as SiteRecord, 'latest', current.nextCursor!)
    expect(history.results).toMatchObject([{ status: 'completed', historical: true }])
  })
  it('filters mixed observations before the 100-result boundary and binds continuations to the scope', async () => {
    const site = { siteId: 'owned-site', projectId: 'site-1' } as SiteRecord
    const row = { id: 'mixed', auditId: 'latest', targetKey: 'module:metadata', status: 'COMPLETED',
      pageUrl: 'https://example.com/', updatedAt: new Date('2026-10-14'), detail: {
        assertions: Array.from({ length: 240 }, (_, index) => ({ key: index % 2 ? 'title-presence' : 'viewport-presence',
          name: 'Assertion ' + index, passed: true, expected: 'Present', observed: 'Recorded', context: String(index) })),
      } }
    findMany.mockResolvedValueOnce([row])
    const first = await loadSiteCheckResultPage(site, 'latest', undefined, new Map(), { area: 'search', pageUrl: row.pageUrl })
    expect(first.results).toHaveLength(100)
    expect(first.results.every(item => item.area === 'search' && item.pageUrl === row.pageUrl)).toBe(true)
    expect(first.results[99].name).toBe('Assertion 199')
    expect(first.nextCursor).not.toBeNull()
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ pageUrl: row.pageUrl,
      targetKey: { in: expect.arrayContaining(['module:metadata']) } }) }))
    for (const scope of [{ area: 'site' as const, pageUrl: row.pageUrl }, { area: 'search' as const, pageUrl: 'https://example.com/other' }])
      await expect(loadSiteCheckResultPage(site, 'latest', first.nextCursor!, new Map(), scope)).rejects.toThrow('Invalid check history cursor')
    await expect(loadSiteCheckResultPage({ ...site, siteId: 'foreign' }, 'latest', first.nextCursor!, new Map(), { area: 'search', pageUrl: row.pageUrl })).rejects.toThrow('Invalid check history cursor')
    findFirst.mockResolvedValueOnce({ id: row.id })
    findMany.mockResolvedValueOnce([row])
    const second = await loadSiteCheckResultPage(site, 'latest', first.nextCursor!, new Map(), { area: 'search', pageUrl: row.pageUrl })
    expect(second.results.filter(item => item.kind === 'assertion')).toHaveLength(20)
    expect(second.results.filter(item => item.kind === 'execution')).toHaveLength(1)
    expect(second.results[0].name).toBe('Assertion 201')
    expect(second.nextCursor).toBeNull()
    expect(new Set([...first.results, ...second.results].map(item => item.id)).size).toBe(121)
  })

  it('returns an explicit exhausted filtered scope instead of unrelated results', async () => {
    findMany.mockResolvedValueOnce([{ id: 'mixed', auditId: 'latest', targetKey: 'module:metadata', status: 'COMPLETED',
      detail: {}, pageUrl: 'https://example.com/', updatedAt: new Date('2026-10-14') }])
    const page = await loadSiteCheckResultPage({ projectId: 'site' } as SiteRecord, 'latest', undefined, new Map(), { area: 'accessibility' })
    expect(page).toEqual({ results: [], nextCursor: null, total: 0 })
  })

  it('counts more than 100 filtered results and rejects changed receipt evidence at the same timestamp', async () => {
    const site = { siteId: 'owned-site', projectId: 'site-1' } as SiteRecord
    const row = { id: 'mixed', auditId: 'latest', targetKey: 'module:metadata', status: 'COMPLETED',
      pageUrl: 'https://example.com/', updatedAt: new Date('2026-10-14'), detail: {
        assertions: Array.from({ length: 240 }, (_, index) => ({ key: index % 2 ? 'title-presence' : 'viewport-presence',
          name: 'Assertion ' + index, passed: true, expected: 'Present', observed: 'Recorded', context: String(index) })),
      } }
    findMany.mockImplementation(async query => query.where.auditId.in ? [row] : [])
    queryRaw.mockImplementation(async query => query.sql.includes('NOT IN') || query.values.includes(row.id) ? [] : [row])
    findFirst.mockImplementation(async query => query.where.id === row.id ? { id: row.id } : null)
    const filter = { area: 'search' as const, pageUrl: row.pageUrl }
    const first = await loadSiteCheckResultPage(site, 'latest', undefined, new Map(), filter, true)
    expect(first.total).toBe(121)
    expect(first.results).toHaveLength(100)
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead', timeout: 15000 })
    const second = await loadSiteCheckResultPage(site, 'latest', first.nextCursor!, new Map(), filter, true)
    expect(second.total).toBe(121)
    expect(second.results).toHaveLength(21)
    expect(second.nextCursor).toBeNull()
    row.detail.assertions[1].observed = 'A different recorded observation'
    await expect(loadSiteCheckResultPage(site, 'latest', first.nextCursor!, new Map(), filter, true))
      .rejects.toThrow('Check evidence selection changed')
  })
  it('exhausts the scope when physical history contains no additional visible observations', async () => {
    const row = { id: 'metadata', auditId: 'latest', targetKey: 'module:metadata', status: 'COMPLETED', detail: {},
      pageUrl: 'https://example.com/', updatedAt: new Date('2026-10-14') }
    findMany.mockResolvedValue([row]); findFirst.mockResolvedValue({ id: row.id })
    queryRaw.mockImplementation(async query => query.values.includes(row.id) ? [] : [row])
    const page = await loadSiteCheckResultPage({ projectId: 'site' } as SiteRecord, 'latest', undefined,
      new Map([['security', { id: 'category' }]]) as never, {}, true)
    expect(page.results).toHaveLength(1)
    expect(page.total).toBe(1)
    expect(page.nextCursor).toBeNull()
  })

})
