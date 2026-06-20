import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { readWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { logPipelineEvent } from '@/lib/audit/pipeline-log'
import { AUDIT_DEADLINE_MS } from '@/lib/audit/pipeline-config'
import { resolveStuckAuditRecovery } from '@/lib/audit/stuck-audit-recovery'

/** Re-enqueue when worker heartbeat is dead and job has waited this long. */
export const WORKER_DEAD_RECOVERY_SECONDS = 90

export type RecoverAuditJobResult = 'requeued' | 'force_failed' | 'noop'

export interface RecoverAuditJobAudit {
  status: string
  updatedAt: Date
  startedAt?: Date | null
}

export function isAuditPastDeadline(
  startedAt: Date | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!startedAt) return false
  return nowMs - startedAt.getTime() > AUDIT_DEADLINE_MS
}

/** QUEUED audits have no startedAt until the worker picks them up. */
export function isQueuedPastDeadline(
  status: string,
  startedAt: Date | null | undefined,
  updatedAt: Date,
  nowMs = Date.now()
): boolean {
  if (status !== 'QUEUED' || startedAt) return false
  return nowMs - updatedAt.getTime() > AUDIT_DEADLINE_MS
}

async function enqueueAuditJob(auditId: string): Promise<void> {
  await getAuditQueue().add(
    'audit',
    { auditId },
    { jobId: auditId, attempts: 1, removeOnComplete: 100, removeOnFail: 500 }
  )
}

async function forceFailAudit(
  auditId: string,
  audit: RecoverAuditJobAudit,
  source: string,
  errorMsg = 'Audit timed out, please try again'
): Promise<void> {
  await logPipelineEvent(auditId, {
    stage: audit.status.toLowerCase(),
    event: 'recovery_force_failed',
    error: errorMsg,
    detail: source,
  })
  await prisma.audit.update({
    where: { id: auditId },
    data: {
      status: 'FAILED',
      errorMsg,
      failureCode: 'AUDIT_TIMEOUT',
      failureStage: audit.status.toLowerCase(),
      failureMetadata: { source },
    },
  })
}

async function requeueAudit(
  auditId: string,
  audit: RecoverAuditJobAudit,
  source: string,
  existingJob: Awaited<ReturnType<ReturnType<typeof getAuditQueue>['getJob']>>
): Promise<void> {
  if (existingJob) {
    try {
      await existingJob.remove()
    } catch {
      // Job may have been picked up between checks.
    }
  }
  await enqueueAuditJob(auditId)
  await logPipelineEvent(auditId, {
    stage: audit.status.toLowerCase(),
    event: 'recovery_requeued',
    detail: source,
  })
  await prisma.audit.update({
    where: { id: auditId },
    data: { updatedAt: new Date(), startedAt: null },
  })
}

/**
 * Poll-time recovery for non-terminal audits (status API, MCP poll).
 */
export async function recoverAuditJobOnPoll(
  auditId: string,
  audit: RecoverAuditJobAudit
): Promise<RecoverAuditJobResult> {
  if (audit.status === 'COMPLETED' || audit.status === 'FAILED') {
    return 'noop'
  }

  if (isAuditPastDeadline(audit.startedAt)) {
    await forceFailAudit(auditId, audit, 'poll')
    return 'force_failed'
  }

  const queue = getAuditQueue()
  const job = await queue.getJob(auditId)
  const jobState = job ? await job.getState() : null

  if (isQueuedPastDeadline(audit.status, audit.startedAt, audit.updatedAt)) {
    if (!job || jobState === 'failed' || jobState === 'completed') {
      await requeueAudit(auditId, audit, 'poll', job)
      return 'requeued'
    }
    if (jobState === 'waiting' || jobState === 'delayed') {
      await requeueAudit(auditId, audit, 'poll', job)
      return 'requeued'
    }
    await forceFailAudit(auditId, audit, 'poll')
    return 'force_failed'
  }

  if (!job || jobState === 'failed' || jobState === 'completed') {
    await requeueAudit(auditId, audit, 'poll', job)
    return 'requeued'
  }

  const ageSeconds = (Date.now() - audit.updatedAt.getTime()) / 1000
  if (ageSeconds < WORKER_DEAD_RECOVERY_SECONDS) {
    return 'noop'
  }

  const heartbeat = await readWorkerHeartbeat()
  if (heartbeat.alive) {
    return 'noop'
  }

  if (jobState === 'waiting' || jobState === 'delayed') {
    await requeueAudit(auditId, audit, 'poll', job)
    return 'requeued'
  }

  if (jobState === 'active') {
    await job.moveToFailed(new Error('Worker unavailable during recovery'), '0', true)
    await forceFailAudit(auditId, audit, 'poll')
    return 'force_failed'
  }

  return 'noop'
}

/**
 * Cron recovery for audits stuck beyond STUCK_AUDIT_MINUTES.
 */
export async function recoverStuckAuditOnCron(
  auditId: string,
  audit: Pick<RecoverAuditJobAudit, 'status' | 'startedAt'>
): Promise<RecoverAuditJobResult> {
  if (audit.status === 'COMPLETED' || audit.status === 'FAILED') {
    return 'noop'
  }

  if (isAuditPastDeadline(audit.startedAt)) {
    const queue = getAuditQueue()
    const job = await queue.getJob(auditId)
    const jobState = job ? await job.getState() : null
    if (job && jobState === 'active') {
      await job.moveToFailed(
        new Error('Audit timed out, force failed by recovery cron'),
        '0',
        true
      )
    }
    await forceFailAudit(auditId, { status: audit.status, updatedAt: new Date() }, 'cron')
    return 'force_failed'
  }

  const queue = getAuditQueue()
  const job = await queue.getJob(auditId)
  const jobState = job ? await job.getState() : null
  const action = resolveStuckAuditRecovery({ status: audit.status, jobState })

  if (job && jobState === 'active') {
    await job.moveToFailed(
      new Error('Audit timed out, force failed by recovery cron'),
      '0',
      true
    )
  }

  if (job && ['waiting', 'delayed'].includes(jobState ?? '')) {
    await job.remove()
  }

  if (action === 'requeue') {
    await enqueueAuditJob(auditId)
    await logPipelineEvent(auditId, {
      stage: audit.status.toLowerCase(),
      event: 'cron_requeued',
    })
    return 'requeued'
  }

  await forceFailAudit(auditId, { status: audit.status, updatedAt: new Date() }, 'cron')
  return 'force_failed'
}
