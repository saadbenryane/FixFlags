import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ cycles: vi.fn(), audits: vi.fn(), projects: vi.fn(), execute: vi.fn(), transaction: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { $transaction: mocks.transaction } }))
import { loadCustomerValueReport } from '../improvement-value-query'

const since = new Date('2026-10-01T00:00:00Z')
const now = new Date('2026-10-13T00:00:00Z')
const at = (day: number) => new Date(`2026-10-${String(day).padStart(2, '0')}T00:00:00Z`)
const row = () => ({ id: 'private-cycle', projectId: 'private-project', createdAt: at(2),
  project: { createdAt: at(1) }, occurrence: { flag: { createdAt: at(2) } },
  sourceAudit: { id: 'private-source', projectId: 'private-project', monitoringAudits: [], createdAt: at(2), runCost: { estimatedCostUsd: 1, createdAt: at(2) } },
  events: [
    { type: 'GENERATED', occurredAt: at(2), outcome: null, rejectionReason: null, verificationAuditId: null },
    { type: 'OUTCOME_ISSUED', occurredAt: at(4), outcome: 'INCONCLUSIVE', rejectionReason: null, verificationAuditId: 'original-review' },
    { type: 'OUTCOME_ISSUED', occurredAt: at(7), outcome: 'IMPROVED', rejectionReason: null, verificationAuditId: 'retry-review' },
    { type: 'IMPROVED', occurredAt: at(7), outcome: 'IMPROVED', rejectionReason: null, verificationAuditId: 'retry-review' },
  ],
})

describe('read-only customer value report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.execute.mockResolvedValue(0)
    mocks.transaction.mockImplementation(async (run) => run({ $executeRaw: mocks.execute,
      improvementCycle: { findMany: mocks.cycles }, audit: { findMany: mocks.audits }, project: { count: mocks.projects } }))
    mocks.cycles.mockResolvedValue([row()]); mocks.projects.mockResolvedValue(1)
    mocks.audits.mockResolvedValue([
      { id: 'original-review', projectId: 'private-project', completedAt: at(4), runCost: { estimatedCostUsd: 2, createdAt: at(4) } },
      { id: 'retry-review', projectId: 'private-project', completedAt: at(7), runCost: { estimatedCostUsd: 3, createdAt: at(7) } },
    ])
  })

  it('resolves original and retry costs through recorded event identities without exposing private rows', async () => {
    const report = await loadCustomerValueReport({ since, now })
    expect(mocks.execute.mock.calls[0][0].join('')).toBe('SET TRANSACTION READ ONLY')
    expect(mocks.transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'RepeatableRead' })
    expect(mocks.audits.mock.calls[0][0].where.id.in).toEqual(['original-review', 'retry-review'])
    expect(report.metrics).toMatchObject({ cohortSize: 1, outcomeIssued: 1, improved: 1,
      estimatedLinkedCheckCostPerImprovedCycleUsd: 6, estimatedVerificationCostPerOutcomeCycleUsd: 5,
      outcomes: { INCONCLUSIVE: 0, IMPROVED: 1 },
      reviewCostCoverage: { runCount: 3, missingRunCount: 0 },
    })
    const json = JSON.stringify(report)
    for (const id of ['private-cycle', 'private-project', 'private-source', 'original-review', 'retry-review']) expect(json).not.toContain(id)
    expect(report.databaseWritten).toBe(false)
    expect(mocks.cycles.mock.calls[0][0].select.events.select).not.toHaveProperty('attempt')
  })

  it('withholds costs for missing or cross-Site outcome audits', async () => {
    mocks.audits.mockResolvedValue([{ id: 'original-review', projectId: 'other-site', completedAt: at(4), runCost: { estimatedCostUsd: 2 } }])
    const { metrics } = await loadCustomerValueReport({ since, now })
    expect(metrics.outcomeCostCoverage.missingRunCount).toBe(2)
    expect(metrics.estimatedLinkedCheckCostPerImprovedCycleUsd).toBeNull()
    expect(metrics.estimatedVerificationCostPerOutcomeCycleUsd).toBeNull()
  })

  it('refuses inconsistent source lineage and never prices a source audit as its own verification', async () => {
    const invalid = row(); invalid.sourceAudit.projectId = 'other-site'
    mocks.cycles.mockResolvedValue([invalid])
    await expect(loadCustomerValueReport({ since, now })).rejects.toThrow('lineage')
    const ownSource = row()
    ownSource.events[1].verificationAuditId = 'private-source'
    mocks.cycles.mockResolvedValue([ownSource])
    mocks.audits.mockResolvedValue([{ id: 'private-source', projectId: 'private-project', completedAt: at(4), runCost: { estimatedCostUsd: 1 } }])
    expect((await loadCustomerValueReport({ since, now })).metrics.estimatedVerificationCostPerOutcomeCycleUsd).toBeNull()
  })

  it('bounds the cohort and active-Site window and rejects oversized reports instead of silently sampling', async () => {
    await loadCustomerValueReport({ since, now })
    expect(mocks.cycles.mock.calls[0][0].where).toEqual({ createdAt: { gte: since, lte: now }, project: { deletedAt: null } })
    expect(mocks.projects.mock.calls[0][0].where).toEqual({ deletedAt: null,
      audits: { some: { status: 'COMPLETED', completedAt: { gte: since, lte: now } } } })
    mocks.cycles.mockResolvedValue(Array.from({ length: 10_001 }, row))
    await expect(loadCustomerValueReport({ since, now })).rejects.toThrow('reporting limit')
  })

  it('does not query a database for invalid windows and skips empty audit lookups', async () => {
    await expect(loadCustomerValueReport({ since: at(14), now })).rejects.toThrow('Invalid')
    expect(mocks.transaction).not.toHaveBeenCalled()
    mocks.cycles.mockResolvedValue([])
    const report = await loadCustomerValueReport({ since, now })
    expect(mocks.audits).not.toHaveBeenCalled()
    expect(report.metrics.cohortSize).toBe(0)
    expect(report.metrics.estimatedLinkedCheckCostPerImprovedCycleUsd).toBeNull()
  })
})
