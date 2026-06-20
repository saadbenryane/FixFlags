import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { readWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'

/** Re-enqueue queued audits with missing/stale Redis jobs during status polling. */
export const QUEUED_RECOVERY_SECONDS = 90

export async function ensureAuditJobEnqueued(
  auditId: string,
  audit: { status: string; updatedAt: Date }
): Promise<boolean> {
  if (audit.status !== 'QUEUED') return false

  const queue = getAuditQueue()
  const job = await queue.getJob(auditId)
  const jobState = job ? await job.getState() : null

  async function requeue(): Promise<boolean> {
    if (job) {
      try {
        await job.remove()
      } catch {
        // Job may have been picked up between checks.
      }
    }
    await queue.add(
      'audit',
      { auditId },
      { jobId: auditId, removeOnComplete: 100, removeOnFail: 500 }
    )
    await prisma.audit.update({
      where: { id: auditId },
      data: { updatedAt: new Date() },
    })
    return true
  }

  if (!job) {
    return requeue()
  }

  if (jobState === 'failed' || jobState === 'completed') {
    return requeue()
  }

  const ageSeconds = (Date.now() - audit.updatedAt.getTime()) / 1000
  if (ageSeconds < QUEUED_RECOVERY_SECONDS) return false

  const heartbeat = await readWorkerHeartbeat()
  if (heartbeat.alive) return false

  if (jobState === 'waiting' || jobState === 'delayed') {
    return requeue()
  }

  return false
}
