import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SiteRecord } from '@/lib/sites/types'
const { findMany, findFirst } = vi.hoisted(() => ({ findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({ prisma: { auditVerifierExecution: { findMany, findFirst } } }))
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
  beforeEach(() => { vi.clearAllMocks(); findMany.mockResolvedValue([]); findFirst.mockResolvedValue(null) })
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
})
