import { Prisma, type RunRequest } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { expireUnownedExecution } from '@/lib/audit/execution-ownership'
import { getUserFacingAuditError } from '@/lib/audit/user-facing-errors'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { lockAdminSiteOperation, type AdminSiteOperationScope } from '@/lib/admin/domain-actor'
import { AdminActionError } from '@/lib/admin/errors'
import { sameSiteRunAuditWhere } from './analysis-scope'
import { RUN_AUDIT_SCOPE_CHANGED } from './run-refusal'

export const ACTIVE_RUN_STATUSES = ['QUEUED', 'RUNNING'] as const
/**
 * How long an unfinished run may hold its Site. Long enough that a slow browser
 * verification is never treated as abandoned, short enough that a dead worker's
 * run stops blocking the Site within one Watch interval.
 */
export const RUN_LEASE_MS = 30 * 60 * 1000
/** Exported so the worker renews exactly the lease the run command takes. */
export const OUTCOME_RUN_LEASE_MS = RUN_LEASE_MS
const ABANDONED_RUN_MESSAGE = 'FixFlags could not finish this verification in time and will try again.'
const RECOVERY_BATCH_SIZE = 100
const RECOVERY_CONCURRENCY = 4

type RecoveryClaim = Pick<RunRequest, 'id' | 'projectId' | 'auditId' | 'updatedAt'>
type ReconcileAudit = (auditId: string, authority?: AdminSiteOperationScope) => Promise<number>

/** Only the physical executor settles unfinished progressive work. Legacy
 * physical leases also outlive request leases. Recheck both at selection and
 * the conditional terminal write; completed observations remain reconcilable. */
const legacyExecutionWhere = { OR: [
  { executionSpec: { path: ['engine'], equals: Prisma.AnyNull } },
  { NOT: { executionSpec: { path: ['engine'], equals: 'progressive-v1' } } },
] } satisfies Prisma.AuditWhereInput
const activeSite = { deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } } satisfies Prisma.ProjectWhereInput

function mismatchedAuditWhere(projectId: string): Prisma.RunRequestWhereInput {
  return { status: { in: [...ACTIVE_RUN_STATUSES] },
    audit: { OR: [{ projectId: null }, { projectId: { not: projectId } }] } }
}

/** Released terminal executions do not need to wait for their request lease.
 * Candidate selection and the conditional write share the same rule. */
function recoverableRunWhere(now: Date): Prisma.RunRequestWhereInput {
  return { AND: [{ OR: [
    { auditId: null },
    { audit: { status: { in: ['COMPLETED', 'FAILED'] } } },
    { audit: legacyExecutionWhere },
  ] }, { OR: [
    { auditId: null },
    { audit: { status: { in: ['COMPLETED', 'FAILED'] } } },
    { audit: { executionLeaseUntil: null } },
    { audit: { executionLeaseUntil: { lte: now } } },
  ] }], status: { in: [...ACTIVE_RUN_STATUSES] }, OR: [
    { leaseUntil: null }, { leaseUntil: { lte: now } },
    { audit: { status: { in: ['COMPLETED', 'FAILED'] }, OR: [
      { executionLeaseUntil: null }, { executionLeaseUntil: { lte: now } },
    ] } },
  ] }
}

/**
 * A run only blocks its Site while it is genuinely in flight.
 *
 * QUEUED and RUNNING are both written before a worker has confirmed the run
 * finished, so a worker death strands the row. Reusing a stranded run would hand
 * the caller a stale audit and silently stop Watch from verifying. A live request
 * or physical lease, a progressive recovery window, or a completed Audit awaiting result
 * reconciliation owns the run. Historical requests without any such evidence
 * can be reclaimed even when their lease is NULL.
 *
 * The lease is a filter, not a lock. Overlapping requests are still serialised by
 * the unique (projectId, source, idempotencyKey) constraint and the single
 * physical Audit per run.
 */
export function activeRunWhere(projectId: string, now: Date): Prisma.RunRequestWhereInput {
  return {
    projectId,
    status: { in: [...ACTIVE_RUN_STATUSES] },
    AND: [sameSiteRunAuditWhere(projectId)],
    // Completed observations retain ownership until their run result commits.
    OR: [{ leaseUntil: { gt: now } }, { audit: { status: { notIn: ['COMPLETED', 'FAILED'] }, OR: [
      { executionLeaseUntil: { gt: now } },
      { recoveryUntil: { gt: now }, executionSpec: { path: ['engine'], equals: 'progressive-v1' } },
    ] } },
      { audit: { status: 'COMPLETED' } }],
  }
}

/**
 * Finish runs that no worker still owns, so they stop blocking their Site.
 *
 * The lease filter alone is not enough. `run_requests_one_active_site_idx` is a
 * partial unique index over `(projectId) WHERE status IN ('QUEUED','RUNNING')`,
 * and a partial index predicate cannot call `now()`, so the database keeps
 * treating an abandoned run as active and rejects any replacement. A query that
 * merely stops counting the stranded run would trade a stale result for a write
 * failure, which is not an improvement.
 *
 * So expiry has to be made terminal, and it is decided where the customer is
 * actually blocked: at the point a new run is requested. Waiting for a periodic
 * sweep would leave a Free Site blocked for a whole Watch interval, because
 * those Sites are only checked weekly.
 *
 * A run whose audit already finished is reconciled rather than failed. The worker
 * may have died after verifying but before recording it, and that result is real,
 * so discarding it would throw away a completed verification.
 */
export function reclaimExpiredRuns(projectId: string, reconcileAudit: ReconcileAudit, authority?: AdminSiteOperationScope): Promise<number> {
  return reclaimSiteRuns(projectId, reconcileAudit, { authority })
}

async function reclaimSiteRuns(projectId: string, reconcileAudit: ReconcileAudit,
  { authority, claim }: { authority?: AdminSiteOperationScope; claim?: RecoveryClaim }): Promise<number> {
  if (authority) {
    if (authority.projectId !== projectId) throw new AdminActionError('This action belongs to another Site.', 403, 'ADMIN_DOMAIN_SCOPE_DENIED')
    await prisma.$transaction(tx => lockAdminSiteOperation(authority, tx))
  }
  const now = new Date()
  const claimScope = claim ? { id: claim.id, auditId: claim.auditId, updatedAt: claim.updatedAt } : {}
  const stranded = await prisma.runRequest.findMany({
    where: {
      projectId,
      ...(authority ? { project: { userId: authority.userId } } : {}),
      OR: [recoverableRunWhere(now), { ...mismatchedAuditWhere(projectId), ...(authority ? {} : { project: activeSite }) }],
      ...claimScope,
    },
    select: { id: true, auditId: true, audit: { select: { projectId: true } } },
  })
  if (stranded.length === 0) return 0

  let reclaimed = 0
  for (const run of stranded) {
    if (run.auditId) {
      if (run.audit && run.audit.projectId !== projectId) {
        const closed = await prisma.$transaction(async tx => {
          if (authority) await lockAdminSiteOperation(authority, tx)
          // Stabilize the current association before closing the request. A
          // contended Audit can yield, including while its owner is claiming it.
          const [mismatched] = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT a.id FROM audits a JOIN run_requests r ON r."auditId" = a.id
            WHERE r.id = ${run.id} AND r."projectId" = ${projectId} AND a.id = ${run.auditId}
              AND a."projectId" IS DISTINCT FROM r."projectId"
            FOR SHARE OF a SKIP LOCKED FOR NO KEY UPDATE OF r SKIP LOCKED`
          if (!mismatched) return { count: 0 }
          return tx.runRequest.updateMany({ where: { ...claimScope, id: run.id, projectId, auditId: run.auditId,
            ...mismatchedAuditWhere(projectId), ...(authority ? { project: { userId: authority.userId } } : { project: activeSite }),
          }, data: { status: 'FAILED', errorCode: RUN_AUDIT_SCOPE_CHANGED.code, errorMessage: RUN_AUDIT_SCOPE_CHANGED.message,
            completedAt: now, leaseUntil: null } })
        })
        reclaimed += closed.count
        continue
      }
      let auditStatus: string | null = null, failureCode: string | null = null
      try {
        const audit = await prisma.audit.findUnique({
          where: { id: run.auditId, ...(authority ? { projectId, userId: authority.userId } : {}) },
          select: { id: true, projectId: true, status: true, failureCode: true, executionSpec: true, executionToken: true, executionGeneration: true, executionLeaseUntil: true },
        })
        if (audit && audit.projectId !== projectId || !audit && authority) continue
        if (audit && !['COMPLETED', 'FAILED'].includes(audit.status) &&
          (readExecutionSpec(audit.executionSpec)?.engine === 'progressive-v1' || audit.executionLeaseUntil && audit.executionLeaseUntil > now)) {
          // Physical execution, not this historical RunRequest lease, owns recovery.
          // Keep admission serialized until its task graph has settled and reconciled.
          continue
        }
        if (audit && !['COMPLETED', 'FAILED'].includes(audit.status)) {
          // Retire the physical Audit first so a delayed delivery cannot restart
          // it after request abandonment. A competing claim keeps ownership.
          if (await expireUnownedExecution(audit, now, { projectId, ...legacyExecutionWhere,
            ...(authority || claim ? { runRequests: { some: { id: run.id, ...recoverableRunWhere(now), ...claimScope } } } : {}) }, authority)) reclaimed++
          continue
        }
        auditStatus = audit?.status ?? null
        failureCode = audit?.failureCode ?? null
      } catch (error) {
        if (error instanceof AdminActionError) throw error
        // A failed read cannot establish abandonment. Physical execution or a
        // completed observation may still own this request's result.
        logger.warn('Run recovery deferred because Audit ownership or settlement could not be established', { runId: run.id, error })
        continue
      }
      if (auditStatus === 'COMPLETED') {
        try {
          // The verification landed. Reclaim it as its real result, not a failure.
          reclaimed += await reconcileAudit(run.auditId, authority)
          continue
        } catch (error) {
          if (error instanceof AdminActionError) throw error
          logger.error('Run result reconciliation deferred; completed Audit retained', { runId: run.id, error })
          continue
        }
      }
      if (auditStatus === 'FAILED') {
        try {
          const { markOutcomeRunsCouldNotVerify } = await import('./run-reconciliation')
          reclaimed += await markOutcomeRunsCouldNotVerify(run.auditId, failureCode ?? 'RUN_ABANDONED',
            failureCode ? getUserFacingAuditError(failureCode) : ABANDONED_RUN_MESSAGE, authority,
            { id: run.id, projectId, ...recoverableRunWhere(now), ...claimScope, audit: { projectId, status: 'FAILED', failureCode } })
        } catch (error) {
          if (error instanceof AdminActionError) throw error
          logger.error('Failed run settlement deferred; Audit failure retained', { runId: run.id, error })
        }
        continue
      }
    }
    const close = (db: Prisma.TransactionClient) => db.runRequest.updateMany({
      // The earlier read is only a candidate list. A worker can renew its lease
      // before this write, so expiry must be re-checked atomically here or a
      // live run can be clobbered as abandoned.
      where: {
        id: run.id,
        projectId,
        ...recoverableRunWhere(now),
        ...claimScope,
        auditId: run.auditId,
        ...(run.auditId ? { audit: { projectId, status: { not: 'COMPLETED' } } } : {}),
      },
      data: {
        status: 'FAILED',
        errorCode: 'RUN_ABANDONED',
        errorMessage: ABANDONED_RUN_MESSAGE,
        completedAt: now,
        leaseUntil: null,
      },
    })
    const failed = authority ? await prisma.$transaction(async tx => {
      await lockAdminSiteOperation(authority, tx, run.auditId ?? undefined)
      return close(tx)
    }) : await close(prisma)
    if (failed.count === 1) {
      reclaimed += 1
      logger.warn('Reclaimed an abandoned Outcome run', { runId: run.id, projectId })
    }
  }
  return reclaimed
}

/** The candidates include expired work and invalid Audit associations. Advance activity for a bounded
 * cohort in one statement so locked requests yield before the limit and a
 * crashed or failed projection leaves its next turn to untouched Sites. */
function claimRecoveryBatch(now: Date) {
  const requestExpired = Prisma.sql`(r."leaseUntil" IS NULL OR r."leaseUntil" <= ${now})`
  const executionReleased = Prisma.sql`(a."executionLeaseUntil" IS NULL OR a."executionLeaseUntil" <= ${now})`
  return prisma.$queryRaw<RecoveryClaim[]>`
    WITH candidates AS (
      SELECT r.id, r."updatedAt", r."requestedAt"
      FROM run_requests r LEFT JOIN audits a ON a.id = r."auditId" AND a."projectId" = r."projectId"
      WHERE r.status IN ('QUEUED', 'RUNNING') AND (
        (r."auditId" IS NULL AND ${requestExpired})
        OR (r."auditId" IS NOT NULL AND a.id IS NULL AND EXISTS (
          SELECT 1 FROM projects p JOIN users u ON u.id = p."userId"
          WHERE p.id = r."projectId" AND p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE'
        ))
        OR (a.status IN ('COMPLETED', 'FAILED') AND (${requestExpired} OR ${executionReleased}))
        OR (a.status NOT IN ('COMPLETED', 'FAILED') AND a."executionSpec"->>'engine' IS DISTINCT FROM 'progressive-v1'
          AND ${executionReleased} AND ${requestExpired})
      )
      ORDER BY r."updatedAt", r."requestedAt", r.id
      LIMIT ${RECOVERY_BATCH_SIZE} FOR NO KEY UPDATE OF r SKIP LOCKED
    ), attempted AS (
      UPDATE run_requests r
      SET "updatedAt" = GREATEST(${now}, r."updatedAt" + INTERVAL '1 millisecond')
      FROM candidates c WHERE r.id = c.id
      RETURNING r.id, r."projectId", r."auditId", r."updatedAt"
    )
    SELECT attempted.* FROM attempted JOIN candidates c USING (id)
    ORDER BY c."updatedAt", c."requestedAt", c.id
  `
}

export async function recoverExpiredSiteRuns(reconcileAudit: ReconcileAudit): Promise<number> {
  const claims = await claimRecoveryBatch(new Date())
  let recovered = 0, next = 0
  await Promise.all(Array.from({ length: Math.min(RECOVERY_CONCURRENCY, claims.length) }, async () => {
    while (next < claims.length) {
      const claim = claims[next++]
      try {
        const count = await reclaimSiteRuns(claim.projectId, reconcileAudit, { claim })
        recovered += count
      }
      catch (error) { logger.error('Site run recovery interrupted; remaining Sites will continue', { projectId: claim.projectId, error }) }
    }
  }))
  return recovered
}
