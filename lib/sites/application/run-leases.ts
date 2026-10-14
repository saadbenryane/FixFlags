import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'

export const ACTIVE_RUN_STATUSES = ['QUEUED', 'RUNNING'] as const
/**
 * How long an unfinished run may hold its Site. Long enough that a slow browser
 * verification is never treated as abandoned, short enough that a dead worker's
 * run stops blocking the Site within one Watch interval.
 */
export const RUN_LEASE_MS = 30 * 60 * 1000
/** Exported so the worker renews exactly the lease the run command takes. */
export const OUTCOME_RUN_LEASE_MS = RUN_LEASE_MS

/**
 * A run only blocks its Site while it is genuinely in flight.
 *
 * QUEUED and RUNNING are both written before a worker has confirmed the run
 * finished, so a worker death strands the row. Reusing a stranded run would hand
 * the caller a stale audit and silently stop Watch from verifying. A live lease,
 * an admitted progressive recovery window, or a completed Audit awaiting result
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
    // Completed observations retain ownership until their run result commits.
    OR: [{ leaseUntil: { gt: now } }, { audit: { status: { notIn: ['COMPLETED', 'FAILED'] },
      recoveryUntil: { gt: now }, executionSpec: { path: ['engine'], equals: 'progressive-v1' } } },
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
export async function reclaimExpiredRuns(projectId: string, reconcileAudit: (auditId: string) => Promise<unknown>): Promise<number> {
  const now = new Date()
  const stranded = await prisma.runRequest.findMany({
    where: {
      projectId,
      status: { in: [...ACTIVE_RUN_STATUSES] },
      // Mirrors the inverse of activeRunWhere: anything without a live lease.
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
    },
    select: { id: true, auditId: true },
  })
  if (stranded.length === 0) return 0

  let reclaimed = 0
  for (const run of stranded) {
    if (run.auditId) {
      let auditStatus: string | null = null
      try {
        const audit = await prisma.audit.findUnique({
          where: { id: run.auditId },
          select: { status: true, executionSpec: true, recoveryUntil: true },
        })
        if (audit && readExecutionSpec(audit.executionSpec)?.engine === 'progressive-v1' && !['COMPLETED', 'FAILED'].includes(audit.status)) {
          // Physical execution, not this historical RunRequest lease, owns recovery.
          // Keep admission serialized until its task graph has settled and reconciled.
          continue
        }
        auditStatus = audit?.status ?? null
      } catch (error) {
        // A failed read cannot establish abandonment. Physical execution or a
        // completed observation may still own this request's result.
        logger.warn('Run recovery deferred because its Audit could not be read', { runId: run.id, error })
        continue
      }
      if (auditStatus === 'COMPLETED') {
        try {
          // The verification landed. Reclaim it as its real result, not a failure.
          await reconcileAudit(run.auditId)
          reclaimed += 1
          continue
        } catch (error) {
          logger.error('Run result reconciliation deferred; completed Audit retained', { runId: run.id, error })
          continue
        }
      }
    }
    const failed = await prisma.runRequest.updateMany({
      // The earlier read is only a candidate list. A worker can renew its lease
      // before this write, so expiry must be re-checked atomically here or a
      // live run can be clobbered as abandoned.
      where: {
        id: run.id,
        auditId: run.auditId,
        status: { in: [...ACTIVE_RUN_STATUSES] },
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
        ...(run.auditId ? { audit: { status: { not: 'COMPLETED' }, OR: [
          { status: 'FAILED' }, { executionSpec: { equals: Prisma.DbNull } },
          { NOT: { executionSpec: { path: ['engine'], equals: 'progressive-v1' } } },
        ] } } : {}),
      },
      data: {
        status: 'FAILED',
        errorCode: 'RUN_ABANDONED',
        errorMessage: 'FixFlags could not finish this verification in time and will try again.',
        completedAt: now,
        leaseUntil: null,
      },
    })
    if (failed.count === 1) {
      reclaimed += 1
      logger.warn('Reclaimed an abandoned Outcome run', { runId: run.id, projectId })
    }
  }
  return reclaimed
}

/** Scheduler-owned recovery also covers requests stranded before queue admission. */
export async function recoverExpiredSiteRuns(reconcileAudit: (auditId: string) => Promise<unknown>): Promise<number> {
  const now = new Date()
  const sites = await prisma.runRequest.findMany({
    where: { status: { in: [...ACTIVE_RUN_STATUSES] }, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
    select: { projectId: true }, orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }], take: 100,
  })
  let recovered = 0
  for (const projectId of new Set(sites.map(run => run.projectId))) {
    try { recovered += await reclaimExpiredRuns(projectId, reconcileAudit) }
    catch (error) { logger.error('Site run recovery interrupted; remaining Sites will continue', { projectId, error }) }
  }
  return recovered
}
