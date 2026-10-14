import { prisma } from '@/lib/db'
import { calculateImprovementValueMetrics } from './improvement-value-metrics'

/** Aggregate retained cycle evidence in one consistent, read-only snapshot. */
export async function loadCustomerValueReport(input: { since: Date; now?: Date }, db: Pick<typeof prisma, '$transaction'> = prisma) {
  const now = input.now ?? new Date()
  if (!Number.isFinite(input.since.getTime()) || !Number.isFinite(now.getTime()) || input.since > now) {
    throw new Error('Invalid customer value observation window')
  }
  const metrics = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    const rows = await tx.improvementCycle.findMany({
      where: { createdAt: { gte: input.since, lte: now }, project: { deletedAt: null } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 10_001,
      select: {
        id: true, projectId: true, createdAt: true,
        project: { select: { createdAt: true } },
        occurrence: { select: { flag: { select: { createdAt: true } } } },
        sourceAudit: { select: {
          id: true, projectId: true, createdAt: true, runCost: { select: { estimatedCostUsd: true, createdAt: true } },
          monitoringAudits: { where: { createdAt: { lte: now } }, select: {
            id: true, projectId: true, createdAt: true, runCost: { select: { estimatedCostUsd: true, createdAt: true } },
          } },
        } },
        events: { where: { occurredAt: { lte: now } }, orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }], select: {
          type: true, occurredAt: true, outcome: true, rejectionReason: true, verificationAuditId: true,
        } },
      },
    })
    if (rows.length > 10_000) throw new Error('Customer value cohort exceeds reporting limit')
    if (rows.some((row) => row.sourceAudit.projectId !== row.projectId ||
      row.sourceAudit.monitoringAudits.some((audit) => audit.projectId !== row.projectId))) {
      throw new Error('Customer value source lineage is inconsistent')
    }
    const ids = [...new Set(rows.flatMap((row) => row.events
      .filter((event) => event.type === 'OUTCOME_ISSUED' && event.verificationAuditId)
      .map((event) => event.verificationAuditId!)))]
    const audits = ids.length > 0 ? await tx.audit.findMany({
      where: { id: { in: ids }, createdAt: { lte: now } },
      select: { id: true, projectId: true, completedAt: true, runCost: { select: { estimatedCostUsd: true, createdAt: true } } },
    }) : []
    const byId = new Map(audits.map((audit) => [audit.id, audit]))
    const activeProductCount = await tx.project.count({ where: { deletedAt: null,
      audits: { some: { status: 'COMPLETED', completedAt: { gte: input.since, lte: now } } },
    } })
    return calculateImprovementValueMetrics(rows.map((row) => ({ ...row,
      events: row.events.map((event) => {
        const audit = event.verificationAuditId ? byId.get(event.verificationAuditId) : null
        return { ...event, verificationAudit: audit?.projectId === row.projectId && audit.id !== row.sourceAudit.id ? audit : null }
      }),
    })), { activeProductCount, now })
  }, { isolationLevel: 'RepeatableRead' })
  const { fullyLoadedReviewCostPerImprovedUsd, outcomeReviewCostPerOutcomeUsd,
    verifiedWorthwhileImprovementsPerActiveProduct, ...observations } = metrics
  return {
    version: 1, asOf: now.toISOString(), cohortStart: input.since.toISOString(),
    source: 'retained-private-improvement-cycles', databaseWritten: false,
    metrics: { ...observations,
      estimatedLinkedCheckCostPerImprovedCycleUsd: fullyLoadedReviewCostPerImprovedUsd,
      estimatedVerificationCostPerOutcomeCycleUsd: outcomeReviewCostPerOutcomeUsd,
      recommendedAcceptedImprovedCyclesPerActiveSite: metrics.activeProductCount > 0
        ? verifiedWorthwhileImprovementsPerActiveProduct : null,
    },
    limitations: [
      'Cycles are grouped by creation date. Stage counts are independent observed actions, not sequential conversion rates.',
      'Improved counts retained system-issued events, not independently re-executed checks or current continuing success.',
      'Outcome distribution uses the latest issued result per cycle. Time to outcome uses its first result. Estimated verification costs include retries.',
      'Later attempts can change current state. Event-time history is resolved using each outcome event’s audit reference.',
      'Recorded check costs are estimates and exclude unlinked runs, support, infrastructure and acquisition costs. Missing estimates withhold ratios.',
      'Deleted Sites and deleted source evidence are absent. This report cannot reconstruct a past database snapshot.',
      'Sites with another generated cycle are not a measure of human return or paid retention. No acquisition or revenue attribution is established.',
    ],
  }
}
