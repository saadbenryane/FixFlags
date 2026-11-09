import { Prisma, type Audit } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { logger } from '@/lib/logger'

export const DISPATCH_LEASE_MS = 30_000
const DISPATCH_CONCURRENCY = 4
type DispatchClaim = Pick<Audit, 'id' | 'dispatchAttempts' | 'createdAt' | 'recoveryUntil'> & { dispatchLeaseUntil: Date }

/** Take short, nonblocking claims and release the database rows before publishing. */
function claimPendingAudits(dueAt: Date, limit: number, auditId?: string) {
  const now = new Date()
  const leaseUntil = new Date(now.getTime() + DISPATCH_LEASE_MS)
  return prisma.$queryRaw<DispatchClaim[]>(Prisma.sql`
    WITH due AS (
      SELECT id FROM audits
      WHERE status = 'QUEUED' AND "dispatchState" = 'PENDING' AND "dispatchNextAt" <= ${dueAt}
        AND ("dispatchLeaseUntil" IS NULL OR "dispatchLeaseUntil" <= ${dueAt})
        ${auditId ? Prisma.sql`AND id = ${auditId}` : Prisma.empty}
      ORDER BY "dispatchNextAt", id
      LIMIT ${limit} FOR NO KEY UPDATE SKIP LOCKED
    )
    UPDATE audits a SET "dispatchLeaseUntil" = ${leaseUntil}, "dispatchAttempts" = a."dispatchAttempts" + 1, "updatedAt" = ${now}
    FROM due WHERE a.id = due.id
    RETURNING a.id, a."dispatchLeaseUntil", a."dispatchAttempts", a."createdAt", a."recoveryUntil"`)
}

function settleDispatch(claim: DispatchClaim, change: Prisma.Sql, requireUnstarted = false) {
  return prisma.$executeRaw(Prisma.sql`
    UPDATE audits SET "dispatchLeaseUntil" = NULL, "updatedAt" = ${new Date()}, ${change}
    WHERE id IN (
      SELECT id FROM audits WHERE id = ${claim.id} AND "dispatchState" = 'PENDING'
        AND "dispatchLeaseUntil" = ${claim.dispatchLeaseUntil}
        ${requireUnstarted ? Prisma.sql`AND status = 'QUEUED'
          AND ("executionLeaseUntil" IS NULL OR "executionLeaseUntil" <= clock_timestamp())` : Prisma.empty}
      FOR NO KEY UPDATE SKIP LOCKED
    )`)
}

async function publishAudit(audit: DispatchClaim) {
  const auditId = audit.id
  try {
    await getAuditQueue().add('audit', { auditId }, { jobId: auditId, attempts: 1, removeOnComplete: 100, removeOnFail: 500 })
  } catch {
    const now = new Date()
    const exhausted = now.getTime() >= (audit.recoveryUntil?.getTime() ?? audit.createdAt.getTime() + 60 * 60_000)
    const retryAt = new Date(now.getTime() + Math.min(60_000, 5000 * 2 ** Math.min(8, audit.dispatchAttempts)))
    const terminal = exhausted ? Prisma.sql`, "dispatchState" = 'FAILED', status = 'FAILED',
      "failureCode" = 'QUEUE_ENQUEUE_FAILED', "failureStage" = 'queue',
      "errorMsg" = 'The automatic recovery window ended before execution could start. No website verdict was established.',
      "completedAt" = ${now}` : Prisma.empty
    const deferred = await settleDispatch(audit, Prisma.sql`
      "dispatchError" = 'Queue admission is temporarily unavailable.', "dispatchNextAt" = ${retryAt}${terminal}`, true)
    // An uncertain producer response cannot override a worker that started or
    // another dispatch claim. Reconcile Runs only from our committed transition.
    if (!deferred) return false
    logger.warn('Audit queue admission will be reconciled', { auditId, exhausted })
    if (exhausted) {
      const { markOutcomeRunsCouldNotVerify } = await import('@/lib/sites/application/run-reconciliation')
      await markOutcomeRunsCouldNotVerify(auditId, 'QUEUE_ENQUEUE_FAILED', 'Automatic recovery ended before execution could start.')
    }
    return false
  }
  // Once the broker accepts the job, a lost acknowledgement write leaves the
  // claim recoverable. It cannot be used as evidence that publication failed.
  await settleDispatch(audit, Prisma.sql`"dispatchState" = 'SENT', "dispatchError" = NULL`)
    .catch(error => logger.error('Audit delivery acknowledgement deferred', error, { auditId }))
  return true
}

/** Foreground admission uses the same durable claim as worker recovery. */
export async function dispatchAudit(auditId: string): Promise<boolean> {
  try {
    const [claim] = await claimPendingAudits(new Date(), 1, auditId)
    return claim ? await publishAudit(claim) : false
  } catch (error) {
    logger.error('Audit dispatch interrupted; retained intent will be retried', error, { auditId })
    return false
  }
}

export async function dispatchPendingAudits(limit = 25): Promise<number> {
  let sent = 0
  const size = Math.max(1, Math.min(limit, 100))
  // A fixed cutoff prevents one failed intent becoming eligible again while
  // a slow broker is still serving this sweep.
  const dueAt = new Date()
  for (let offset = 0; offset < size; offset += DISPATCH_CONCURRENCY) {
    const batchSize = Math.min(DISPATCH_CONCURRENCY, size - offset)
    const claims = await claimPendingAudits(dueAt, batchSize)
    const results = await Promise.allSettled(claims.map(publishAudit))
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') { if (result.value) sent++ }
      else logger.error('Audit dispatch interrupted; retained intent will be retried', result.reason, { auditId: claims[index].id })
    }
    if (claims.length < batchSize) break
  }
  return sent
}
