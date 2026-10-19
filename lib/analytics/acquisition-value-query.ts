import { prisma } from '@/lib/db'
import { anonymousAcquisitionAuditId, calculateAcquisitionValueCohort } from './acquisition-value-cohort'
import { analysisCompletionKeys } from './analysis-completion'

export async function loadAcquisitionValueCohort(input: { since: Date; now?: Date }, db: Pick<typeof prisma, '$transaction'> = prisma) {
  const now = input.now ?? new Date()
  if (!Number.isFinite(input.since.getTime()) || !Number.isFinite(now.getTime()) || input.since > now) throw new Error('Invalid acquisition window')
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    const starts = await tx.siteLifecycleEvent.findMany({
      where: { name: 'analyze_started', version: 1, userId: null, createdAt: { gte: input.since, lte: now } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 10_001,
      select: { idempotencyKey: true, properties: true, createdAt: true, userId: true, version: true },
    })
    if (starts.length > 10_000) throw new Error('Acquisition cohort exceeds reporting limit')
    const ids = [...new Set(starts.map(anonymousAcquisitionAuditId).filter((id): id is string => Boolean(id)))]
    const auditSelect = { id: true, userId: true, projectId: true, parentId: true, source: true, status: true,
      createdAt: true, startedAt: true, completedAt: true,
      project: { select: { id: true, userId: true, deletedAt: true } },
    } as const
    const audits = ids.length ? await tx.audit.findMany({ where: { id: { in: ids } }, select: auditSelect }) : []
    const projects = [...new Set(audits.map((audit) => audit.projectId).filter((id): id is string => Boolean(id)))]
    const [results, claims, cycles] = await Promise.all([
      ids.length ? tx.siteLifecycleEvent.findMany({ where: { name: { in: ['analysis_completed', 'first_useful_result'] }, version: 1,
        idempotencyKey: { in: ids.flatMap(analysisCompletionKeys) }, createdAt: { lte: now } },
        select: { idempotencyKey: true, createdAt: true } }) : [],
      projects.length ? tx.siteLifecycleEvent.findMany({ where: { name: 'analysis_claimed', version: 1,
        projectId: { in: projects }, idempotencyKey: { in: ids.map((id) => `analysis_claimed:${id}`) }, createdAt: { lte: now } },
        select: { idempotencyKey: true, projectId: true, userId: true, createdAt: true } }) : [],
      ids.length ? tx.improvementCycle.findMany({ where: { sourceAuditId: { in: ids }, createdAt: { lte: now } }, take: 50_001,
        select: { id: true, projectId: true, sourceAuditId: true, improvementId: true, createdAt: true,
          improvement: { select: { projectId: true } },
          occurrence: { select: { improvementId: true, auditId: true, flag: { select: { auditId: true, createdAt: true } } } },
          events: { where: { occurredAt: { lte: now } }, select: { type: true, transport: true, occurredAt: true,
            outcome: true, attemptId: true, verificationAuditId: true,
            attempt: { select: { id: true, sourceAuditId: true, improvementId: true, createdAt: true } },
          } },
        },
      }) : [],
    ])
    if (cycles.length > 50_000) throw new Error('Acquisition evidence exceeds reporting limit')
    const verifications = [...new Set(cycles.flatMap((cycle) => cycle.events
      .filter((event) => event.type === 'OUTCOME_ISSUED' && event.verificationAuditId)
      .map((event) => event.verificationAuditId!)))]
    const after = verifications.length ? await tx.audit.findMany({ where: { id: { in: verifications } }, select: auditSelect }) : []
    return calculateAcquisitionValueCohort({ starts, audits: [...audits, ...after], results, claims, cycles, since: input.since, now })
  }, { isolationLevel: 'RepeatableRead' })
}
