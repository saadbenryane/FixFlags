import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SiteRecord } from '@/lib/sites/types'
import { loadMonitoringHistory } from '../monitoring-history'
import { includeLegacySiteAnalyses } from '../analysis-scope'

const reads = vi.hoisted(() => ({ audits: vi.fn(), executions: vi.fn(), flags: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: {
  audit: { findMany: reads.audits }, auditVerifierExecution: { findMany: reads.executions }, flag: { findMany: reads.flags },
} }))

const site: SiteRecord = { siteId: 'p_creator', kind: 'provisional', provisionalSiteId: 'creator', projectId: null,
  primaryAuditId: 'creator-audit', userId: null, name: 'example.com', url: 'https://example.com/', canonicalHost: 'example.com',
  watchInterval: null, watchNextRunAt: null, watchLastRunAt: null, watchLastError: null, watchConsecutiveFailures: 0 }
const selection = { legacyIds: ['creator-audit'], where: includeLegacySiteAnalyses(['creator-audit']) }

describe('provisional Site history boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    reads.audits.mockResolvedValue([])
    reads.executions.mockResolvedValue([])
    reads.flags.mockResolvedValue([])
  })

  it('includes the creator’s recorded check without querying every unclaimed audit', async () => {
    const at = new Date('2026-10-24T12:00:00Z')
    reads.audits.mockResolvedValue([{ id: 'creator-audit', parentId: null, status: 'COMPLETED', failureCode: null,
      failedModules: [], evidenceCoverage: null, pages: [], flags: [], completedAt: at, updatedAt: at,
      executionSpec: null, recheckTrigger: 'MANUAL', verificationAttempts: [], runRequests: [] }])
    const history = await loadMonitoringHistory(site, selection)
    expect(history.timeline.map(entry => entry.id)).toEqual(['creator-audit'])
    expect(history.trend.map(entry => entry.id)).toEqual(['creator-audit'])
    for (const [query] of reads.audits.mock.calls) expect(query.where).toMatchObject({
      id: 'creator-audit', projectId: null, userId: null,
    })
    expect(reads.audits).toHaveBeenCalledTimes(2)
  })

  it('does not read history without a recorded primary analysis', async () => {
    expect(await loadMonitoringHistory({ ...site, primaryAuditId: null }, selection)).toEqual({ timeline: [], trend: [] })
    expect(reads.audits).not.toHaveBeenCalled()
    expect(reads.executions).not.toHaveBeenCalled()
  })

  it('keeps claimed history scoped to its project', async () => {
    await loadMonitoringHistory({ ...site, kind: 'project', siteId: 'owned', projectId: 'owned', userId: 'owner' }, selection)
    for (const [query] of reads.audits.mock.calls) {
      expect(query.where.projectId).toBe('owned')
      expect(query.where).not.toHaveProperty('id')
    }
    expect(reads.audits).toHaveBeenCalledTimes(2)
  })
})
