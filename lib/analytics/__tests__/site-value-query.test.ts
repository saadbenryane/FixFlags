import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ claims: vi.fn(), sites: vi.fn(), runs: vi.fn(), cycles: vi.fn(), audits: vi.fn(), execute: vi.fn(), transaction: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { $transaction: mocks.transaction } }))
import { loadSiteValueCohort } from '../site-value-query'
const since = new Date('2026-09-01T00:00:00Z')
const now = new Date('2026-10-20T00:00:00Z')

describe('Site follow-up cohort query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (run) => run({ $executeRaw: mocks.execute,
      siteLifecycleEvent: { findMany: mocks.claims }, project: { findMany: mocks.sites }, runRequest: { findMany: mocks.runs },
      improvementCycle: { findMany: mocks.cycles }, audit: { findMany: mocks.audits } }))
    for (const read of [mocks.claims, mocks.sites, mocks.runs, mocks.cycles, mocks.audits]) read.mockResolvedValue([])
  })
  it.each([undefined, 7, 28] as const)('retains read-only snapshot and empty evidence semantics for %s days', async (followupDays) => {
    const report = await loadSiteValueCohort({ since, now, followupDays })
    expect(report.followupDays).toBe(followupDays ?? 7)
    expect(mocks.execute.mock.calls[0][0].join('')).toBe('SET TRANSACTION READ ONLY')
    expect(mocks.transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'RepeatableRead' })
    expect(mocks.claims.mock.calls[0][0].where.createdAt).toEqual({ lte: now })
    expect(report.counts.sites).toBe(0)
    expect(report.observedSharesPct.completedScheduledChecks).toBeNull()
    expect(mocks.runs).not.toHaveBeenCalled()
  })
  it('propagates 28-day maturity while selecting first claims before window filtering', async () => {
    mocks.claims.mockResolvedValue([
      { idempotencyKey: 'analysis_claimed:old', projectId: 'old-site', userId: 'owner', createdAt: new Date('2026-08-01T00:00:00Z') },
      { idempotencyKey: 'analysis_claimed:later', projectId: 'old-site', userId: 'owner', createdAt: since },
      { idempotencyKey: 'analysis_claimed:new', projectId: 'new-site', userId: 'owner', createdAt: new Date('2026-10-01T00:00:00Z') },
    ])
    const report = await loadSiteValueCohort({ since, now, followupDays: 28 })
    expect(report).toMatchObject({ followupDays: 28, counts: { sites: 0 }, coverage: { firstRecordedClaims: 1, immatureSites: 1 } })
    expect(mocks.sites.mock.calls[0][0].where).toEqual({ id: { in: ['new-site'] } })
    expect(mocks.runs.mock.calls[0][0].where).toEqual({ projectId: { in: ['new-site'] }, environment: 'production', requestedAt: { gte: since, lte: now } })
    expect(mocks.audits.mock.calls[0][0].select).not.toHaveProperty('url')
    expect(mocks.cycles.mock.calls[0][0].select.events.select.attempt.select).toEqual({ id: true, sourceAuditId: true, improvementId: true, createdAt: true })
  })
  it('rejects unsupported durations before any database operation', async () => {
    await expect(loadSiteValueCohort({ since, now, followupDays: 14 as 7 })).rejects.toThrow('Invalid Site follow-up duration')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
