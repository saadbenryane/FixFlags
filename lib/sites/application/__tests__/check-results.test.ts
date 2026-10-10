import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SiteRecord } from '@/lib/sites/types'
const findMany = vi.hoisted(() => vi.fn().mockResolvedValue([]))
vi.mock('@/lib/db', () => ({ prisma: { auditVerifierExecution: { findMany } } }))
import { loadSiteCheckResults } from '../check-results'

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
})
