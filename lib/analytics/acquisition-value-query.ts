import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { ACQUISITION_FOLLOWUP_DAYS, anonymousAcquisitionAuditId, calculateAcquisitionValueCohort, fixedStartWindow,
  type AcquisitionAdmissionCoverage } from './acquisition-value-cohort'
import { analysisCompletionKeys } from './analysis-completion'

type AcquisitionValueWindow = { since: Date; now?: Date; startWindowEnd?: Date }
const MAX_STARTS = 10_000
const DAY = 86_400_000

function validateAcquisitionValueCohort(input: AcquisitionValueWindow & { now: Date }) {
  const now = input.now
  if (!Number.isFinite(input.since.getTime()) || !Number.isFinite(now.getTime()) || input.since > now) throw new Error('Invalid acquisition window')
  if (input.startWindowEnd) fixedStartWindow(input.since, input.startWindowEnd, now, ACQUISITION_FOLLOWUP_DAYS)
  return now
}

export async function loadAcquisitionValueCohort(input: AcquisitionValueWindow, db: Pick<typeof prisma, '$transaction'> = prisma) {
  const window = { ...input, now: input.now ?? new Date() }
  validateAcquisitionValueCohort(window)
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    return readAcquisitionValueCohort(tx, window)
  }, { isolationLevel: 'RepeatableRead' })
}

/** Check a lower bound from independent admission evidence. Never assign these rows to a guide. */
async function readAdmissionReceiptCoverage(tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
  { since, now, startWindowEnd }: AcquisitionValueWindow & { now: Date }): Promise<AcquisitionAdmissionCoverage> {
  const matureBy = new Date(now.getTime() - ACQUISITION_FOLLOWUP_DAYS * DAY)
  const [counts] = await tx.$queryRaw<Array<{
    retainedMatureAdmissions: number; missingStartReceipts: number; unusableStartReceipts: number; startReceiptsOutsideWindow: number
  }>>`
    WITH admitted AS (
      SELECT audit.id, audit."createdAt"
      FROM audits audit
      WHERE audit."createdAt" BETWEEN ${since} AND ${matureBy}
        AND audit."createdAt" < ${startWindowEnd ?? now}
        AND audit."parentId" IS NULL AND audit.source <> 'SEED' AND audit."planAtAdmission" IS NULL
        AND (
          EXISTS (
            SELECT 1 FROM provisional_sites site
            WHERE site."primaryAuditId" = audit.id
              AND site."claimedProjectId" IS NOT DISTINCT FROM audit."projectId"
              AND (audit."userId" IS NULL) = (audit."projectId" IS NULL)
          )
          OR EXISTS (
            SELECT 1 FROM site_lifecycle_events claim
            WHERE claim."idempotencyKey" = ('analysis_claimed:' || audit.id)
              AND claim.name = 'analysis_claimed' AND claim.version = 1
              AND claim."projectId" = audit."projectId" AND claim."userId" = audit."userId"
              AND claim."createdAt" BETWEEN audit."createdAt" AND ${now}
          )
        )
      LIMIT ${MAX_STARTS + 1}
    ), receipt_states AS (
      SELECT CASE
        WHEN receipt.id IS NULL THEN 'missing'
        WHEN NOT COALESCE(receipt.name = 'analyze_started' AND receipt.version = 1
          AND receipt."userId" IS NULL AND receipt.properties->'anonymous' = 'true'::jsonb
          AND receipt."createdAt" >= admitted."createdAt", false) THEN 'unusable'
        WHEN ${Boolean(startWindowEnd)} AND receipt."createdAt" >= ${startWindowEnd ?? now} THEN 'outside-window'
        ELSE 'in-window' END AS state
      FROM admitted
      LEFT JOIN site_lifecycle_events receipt ON receipt."idempotencyKey" = ('analyze_started:' || admitted.id)
        AND receipt."createdAt" <= ${now}
    )
    SELECT count(*)::int AS "retainedMatureAdmissions",
      count(*) FILTER (WHERE state = 'missing')::int AS "missingStartReceipts",
      count(*) FILTER (WHERE state = 'unusable')::int AS "unusableStartReceipts",
      count(*) FILTER (WHERE state = 'outside-window')::int AS "startReceiptsOutsideWindow"
    FROM receipt_states
  `
  return counts.retainedMatureAdmissions > MAX_STARTS ? { status: 'admission-limit-exceeded' } : { status: 'observed', ...counts }
}

export async function readAcquisitionValueCohort(tx: Prisma.TransactionClient, input: AcquisitionValueWindow & { now: Date }) {
  const now = validateAcquisitionValueCohort(input)
  const starts = await tx.siteLifecycleEvent.findMany({
    where: { name: 'analyze_started', version: 1, userId: null,
      createdAt: { gte: input.since, ...(input.startWindowEnd ? { lt: input.startWindowEnd } : { lte: now }) } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_STARTS + 1,
    select: { idempotencyKey: true, properties: true, createdAt: true, userId: true, version: true },
  })
  if (starts.length > MAX_STARTS) throw new Error('Acquisition cohort exceeds reporting limit')
  const ids = [...new Set(starts.map(anonymousAcquisitionAuditId).filter((id): id is string => Boolean(id)))]
  const auditSelect = { id: true, userId: true, projectId: true, parentId: true, source: true, status: true,
    createdAt: true, startedAt: true, completedAt: true, failureCode: true,
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
  const admissionReceiptCoverage = await readAdmissionReceiptCoverage(tx, input)
  return calculateAcquisitionValueCohort({ ...input, starts, audits: [...audits, ...after], results, claims, cycles, now, admissionReceiptCoverage })
}
