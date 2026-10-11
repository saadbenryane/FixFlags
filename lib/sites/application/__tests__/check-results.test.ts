import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SiteRecord } from '@/lib/sites/types'
const { findMany, findFirst } = vi.hoisted(() => ({ findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({ prisma: { auditVerifierExecution: { findMany, findFirst } } }))
import { loadSiteCheckResults, loadSiteCheckResultPage, CHECK_RESULT_PAGE_SIZE } from '../check-results'

describe('Site result access and provenance', () => {
  beforeEach(() => vi.clearAllMocks())
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
    expect(await loadSiteCheckResults({ projectId: 'site-1' } as SiteRecord, 'latest')).toMatchObject([
      { auditId: 'previous', historical: true, checkedAt: '2026-10-01T12:00:00.000Z' },
    ])
  })
  it('bounds reads and rejects a cursor outside the authorized Site', async () => {
    const site = { projectId: 'site-1' } as SiteRecord
    await loadSiteCheckResultPage(site, 'latest')
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: CHECK_RESULT_PAGE_SIZE + 1, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] }))
    await expect(loadSiteCheckResultPage(site, 'latest', 'foreign')).rejects.toThrow('Invalid check history cursor')
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'foreign', audit: { projectId: 'site-1' } }) }))
  })
  it('keeps the latest failed result current and the older success historical', async () => {
    const base = { targetKey: 'module:metadata', detail: {}, pageUrl: 'https://example.com', updatedAt: new Date('2026-10-11') }
    findMany.mockResolvedValueOnce([{ ...base, id: 'new', auditId: 'latest', status: 'FAILED' }, { ...base, id: 'old', auditId: 'prior', status: 'COMPLETED' }])
    expect(await loadSiteCheckResults({ projectId: 'site-1' } as SiteRecord, 'latest')).toMatchObject([{ status: 'failed', historical: false }, { status: 'completed', historical: true }])
  })
})
