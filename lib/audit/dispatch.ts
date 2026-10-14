import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { logger } from '@/lib/logger'

export const DISPATCH_LEASE_MS = 30_000

/** Queue admission is a durable Audit transition with an idempotent job identity. */
export async function dispatchAudit(auditId: string): Promise<boolean> {
  const now = new Date()
  const leaseUntil = new Date(now.getTime() + DISPATCH_LEASE_MS)
  const claimed = await prisma.audit.updateMany({
    where: { id: auditId, status: 'QUEUED', dispatchState: 'PENDING', dispatchNextAt: { lte: now },
      OR: [{ dispatchLeaseUntil: null }, { dispatchLeaseUntil: { lte: now } }] },
    data: { dispatchLeaseUntil: leaseUntil, dispatchAttempts: { increment: 1 } },
  })
  if (claimed.count !== 1) return false
  const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, select: { dispatchAttempts: true, createdAt: true, recoveryUntil: true } })
  try {
    await getAuditQueue().add('audit', { auditId }, { jobId: auditId, attempts: 1, removeOnComplete: 100, removeOnFail: 500 })
    await prisma.audit.updateMany({ where: { id: auditId, dispatchState: 'PENDING', dispatchLeaseUntil: leaseUntil }, data: {
      dispatchState: 'SENT', dispatchLeaseUntil: null, dispatchError: null,
    } })
    return true
  } catch {
    const exhausted = now.getTime() >= (audit.recoveryUntil?.getTime() ?? audit.createdAt.getTime() + 60 * 60_000)
    await prisma.audit.updateMany({ where: { id: auditId, status: 'QUEUED', dispatchState: 'PENDING', dispatchLeaseUntil: leaseUntil }, data: {
      dispatchLeaseUntil: null, dispatchError: 'Queue admission is temporarily unavailable.',
      dispatchNextAt: new Date(now.getTime() + Math.min(60_000, 5000 * 2 ** Math.min(8, audit.dispatchAttempts))),
      ...(exhausted ? { dispatchState: 'FAILED', status: 'FAILED', failureCode: 'QUEUE_ENQUEUE_FAILED', failureStage: 'queue',
        errorMsg: 'The automatic recovery window ended before execution could start. No website verdict was established.', completedAt: now } : {}),
    } })
    logger.warn('Audit queue admission will be reconciled', { auditId, exhausted })
    if (exhausted) {
      const { markOutcomeRunsCouldNotVerify } = await import('@/lib/sites/application/run-reconciliation')
      await markOutcomeRunsCouldNotVerify(auditId, 'QUEUE_ENQUEUE_FAILED', 'Automatic recovery ended before execution could start.')
    }
    return false
  }
}

export async function dispatchPendingAudits(limit = 25): Promise<number> {
  const now = new Date()
  const audits = await prisma.audit.findMany({ where: { status: 'QUEUED', dispatchState: 'PENDING', dispatchNextAt: { lte: now },
    OR: [{ dispatchLeaseUntil: null }, { dispatchLeaseUntil: { lte: now } }] },
    orderBy: [{ dispatchNextAt: 'asc' }, { id: 'asc' }], take: Math.max(1, Math.min(limit, 100)), select: { id: true } })
  let sent = 0
  for (const audit of audits) {
    try { if (await dispatchAudit(audit.id)) sent++ }
    catch (error) { logger.error('Audit dispatch interrupted; retained intent will be retried', error, { auditId: audit.id }) }
  }
  return sent
}
