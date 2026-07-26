import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { readWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { logPipelineEvent } from '@/lib/audit/pipeline-log'
import { AUDIT_DEADLINE_MS, STUCK_AUDIT_MINUTES } from '@/lib/audit/pipeline-config'
import { resolveStuckAuditRecovery, stuckAuditCutoff } from '@/lib/audit/stuck-audit-recovery'

/** Re-enqueue when worker heartbeat is dead and job has waited this long. */
export const WORKER_DEAD_RECOVERY_SECONDS = 90

/**
 * Once an audit has been waiting on a dead worker longer than this, stop
 * re-enqueuing and fail it with a clear message. Without this bound, a worker
 * that never comes up (not deployed, missing env, crash-looping) makes the UI
 * loop on "scanning" forever because each poll just requeues the job.
 */
export const WORKER_DOWN_GIVEUP_SECONDS = 180

/**
 * Grace window past the hard deadline before the poll force-fails a still-active
 * run. The worker enforces its own deadline (AuditDeadlineError → graceful
 * partial finalize); this grace lets that path win so a near-complete run isn't
 * clobbered into FAILED by a poll firing at the exact same moment.
 */
export const POLL_FORCE_FAIL_GRACE_MS = 15_000

const WORKER_DOWN_MESSAGE =
  'Our scanner is temporarily unavailable. Please try again in a few minutes.'

export type RecoverAuditJobResult = 'requeued' | 'force_failed' | 'noop'

export interface RecoverAuditJobAudit {
  status: string
  updatedAt: Date
  startedAt?: Date | null
  createdAt?: Date | null
}

export function isAuditPastDeadline(
  startedAt: Date | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!startedAt) return false
  return nowMs - startedAt.getTime() > AUDIT_DEADLINE_MS
}

/**
 * True once an audit has been waiting on a down worker long enough that we
 * should stop re-enqueuing and fail it with a clear message.
 */
export function isWorkerDownGiveUp(
  createdAt: Date | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!createdAt) return false
  return nowMs - createdAt.getTime() > WORKER_DOWN_GIVEUP_SECONDS * 1000
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
  errorMsg = 'Audit timed out, please try again',
  failureCode = 'AUDIT_TIMEOUT'
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
      failureCode,
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

  const queue = getAuditQueue()
  const job = await queue.getJob(auditId)
  const jobState = job ? await job.getState() : null

  // Past the deadline (plus a grace window so the worker's own graceful finalize
  // can win): force-fail AND kill the still-active job so the DB status and the
  // queue stay consistent - otherwise a lingering active job makes Retry throw
  // "Audit is already running". FINALIZING is still non-terminal and receives
  // the same grace; a lost worker must not leave it there indefinitely.
  if (
    isAuditPastDeadline(audit.startedAt, Date.now() - POLL_FORCE_FAIL_GRACE_MS)
  ) {
    if (job && jobState === 'active') {
      await job.moveToFailed(new Error('Audit exceeded deadline'), '0', true)
    }
    await forceFailAudit(
      auditId,
      audit,
      'poll',
      'Audit exceeded its hard deadline. Retry the check.',
      'AUDIT_HARD_DEADLINE'
    )
    return 'force_failed'
  }

  // If the audit has been alive far longer than a normal run and the worker
  // heartbeat is dead, stop re-enqueuing (which loops the UI on "scanning")
  // and fail with a clear message. Checked before the requeue branches so it
  // applies whether the audit is QUEUED or mid-run.
  if (isWorkerDownGiveUp(audit.createdAt)) {
    const heartbeat = await readWorkerHeartbeat()
    if (!heartbeat.alive) {
      if (job && jobState === 'active') {
        await job.moveToFailed(new Error('Worker unavailable during recovery'), '0', true)
      }
      await forceFailAudit(auditId, audit, 'poll', WORKER_DOWN_MESSAGE)
      return 'force_failed'
    }
  }

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
    if (audit.status === 'QUEUED' && !audit.startedAt) {
      await requeueAudit(auditId, audit, 'poll', job)
      return 'requeued'
    }
    await forceFailAudit(
      auditId,
      audit,
      'poll',
      'The scanner stopped before this report could finish. Retry the check.',
      'AUDIT_JOB_LOST'
    )
    return 'force_failed'
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

export interface StuckAuditSweepResult {
  requeued: number
  failed: number
  checked: number
}

/**
 * Find audits stuck beyond STUCK_AUDIT_MINUTES and recover each. Single source
 * of truth shared by the HTTP endpoint (/api/cron/recover-stuck-audits) and the
 * internal recovery scheduler, so both behave identically.
 */
async function queryStuckAudits(cutoff: Date, retries = 2): Promise<Array<{ id: string; status: string; startedAt: Date | null }>> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await prisma.audit.findMany({
        where: {
          status: { notIn: ['COMPLETED', 'FAILED'] },
          updatedAt: { lt: cutoff },
        },
        select: { id: true, status: true, startedAt: true },
      })
    } catch (err) {
      if (attempt < retries) {
        const delay = 1_000 * 2 ** attempt
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      throw err
    }
  }
  return []
}

export async function runStuckAuditRecoverySweep(): Promise<StuckAuditSweepResult> {
  const cutoff = stuckAuditCutoff(Date.now(), STUCK_AUDIT_MINUTES)
  const stuckAudits = await queryStuckAudits(cutoff)

  let requeued = 0
  let failed = 0
  for (const audit of stuckAudits) {
    const result = await recoverStuckAuditOnCron(audit.id, audit)
    if (result === 'requeued') requeued++
    if (result === 'force_failed') failed++
  }

  return { requeued, failed, checked: stuckAudits.length }
}
