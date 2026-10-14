import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ events: vi.fn(), audits: vi.fn(), cycles: vi.fn(), execute: vi.fn(), transaction: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { $transaction: mocks.transaction } }))
import { loadAcquisitionValueCohort } from '../acquisition-value-query'

const since = new Date('2026-10-01'); const now = new Date('2026-10-13')
describe('private acquisition-to-value query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (run) => run({ $executeRaw: mocks.execute,
      siteLifecycleEvent: { findMany: mocks.events }, audit: { findMany: mocks.audits }, improvementCycle: { findMany: mocks.cycles } }))
    mocks.events.mockResolvedValue([]); mocks.audits.mockResolvedValue([]); mocks.cycles.mockResolvedValue([])
  })

  it('reads a bounded, versioned cohort in a consistent read-only snapshot and skips empty lookups', async () => {
    const report = await loadAcquisitionValueCohort({ since, now })
    expect(mocks.execute.mock.calls[0][0].join('')).toBe('SET TRANSACTION READ ONLY')
    expect(mocks.transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'RepeatableRead' })
    expect(mocks.events.mock.calls[0][0].where).toEqual({ name: 'analyze_started', version: 1, userId: null, createdAt: { gte: since, lte: now } })
    expect(report.matureCohort.starts).toBe(0)
    expect(mocks.audits).not.toHaveBeenCalled(); expect(mocks.cycles).not.toHaveBeenCalled()
  })

  it('queries repairs by the exact initial source and ignores mutable attempt outcomes and run pointers', async () => {
    mocks.events.mockResolvedValueOnce([{ idempotencyKey: 'analyze_started:source', properties: { anonymous: true }, createdAt: since, version: 1, userId: null }])
      .mockResolvedValue([])
    mocks.audits.mockResolvedValue([{ id: 'source', userId: null, projectId: null, parentId: null, source: 'HOMEPAGE', createdAt: since, project: null }])
    await loadAcquisitionValueCohort({ since, now })
    expect(mocks.cycles.mock.calls[0][0].where).toEqual({ sourceAuditId: { in: ['source'] }, createdAt: { lte: now } })
    expect(mocks.cycles.mock.calls[0][0].select.events.select.attempt.select).toEqual({ id: true, sourceAuditId: true, improvementId: true, createdAt: true })
    expect(mocks.audits.mock.calls[0][0].select).not.toHaveProperty('url')
  })

  it('refuses invalid and oversized cohorts instead of inventing a partial denominator', async () => {
    await expect(loadAcquisitionValueCohort({ since: new Date(NaN), now })).rejects.toThrow('Invalid')
    expect(mocks.transaction).not.toHaveBeenCalled()
    mocks.events.mockResolvedValue(Array.from({ length: 10_001 }, () => ({})))
    await expect(loadAcquisitionValueCohort({ since, now })).rejects.toThrow('reporting limit')
    expect(mocks.audits).not.toHaveBeenCalled()
  })
})
