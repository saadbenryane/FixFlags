import { getAuditQueue } from '@/lib/queue/client'

export const WORKER_CONCURRENCY = 3
export const AVG_JOB_DURATION_SECONDS = 30

export interface QueueEstimate {
  activeJobs: number
  waitingJobs: number
  delayedJobs: number
  estimatedWaitSeconds: number
}

export async function getWorkerQueueEstimate(): Promise<QueueEstimate> {
  const queue = getAuditQueue()
  const [activeJobs, waitingJobs, delayedJobs] = await Promise.all([
    queue.getActiveCount(),
    queue.getWaitingCount(),
    queue.getDelayedCount(),
  ])
  const totalAhead = activeJobs + waitingJobs + delayedJobs
  const estimatedWaitSeconds = Math.max(
    15,
    Math.ceil(totalAhead / WORKER_CONCURRENCY) * AVG_JOB_DURATION_SECONDS
  )

  return { activeJobs, waitingJobs, delayedJobs, estimatedWaitSeconds }
}

export interface AuditQueueInfo {
  queuePosition: number
  estimatedWaitSeconds: number
  scheduledStartAt: string | null
  isDelayed: boolean
}

export async function getAuditQueueInfo(auditId: string): Promise<AuditQueueInfo | null> {
  const queue = getAuditQueue()
  const job = await queue.getJob(auditId)
  if (!job) return null

  const state = await job.getState()
  const [active, waiting, delayed] = await Promise.all([
    queue.getActiveCount(),
    queue.getWaitingCount(),
    queue.getDelayedCount(),
  ])

  if (state === 'delayed') {
    const delayMs = typeof job.opts.delay === 'number' ? job.opts.delay : 0
    const processedOn = job.processedOn ?? job.timestamp ?? Date.now()
    const scheduledStartAt = new Date(processedOn + delayMs)
    const remainingMs = Math.max(0, scheduledStartAt.getTime() - Date.now())
    const jobsAhead = active + waiting + delayed
    return {
      queuePosition: jobsAhead,
      estimatedWaitSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
      scheduledStartAt: scheduledStartAt.toISOString(),
      isDelayed: true,
    }
  }

  if (state === 'waiting') {
    const waitingJobs = await queue.getWaiting()
    const index = waitingJobs.findIndex((j) => j.id === auditId)
    const position = index >= 0 ? active + index + 1 : active + waiting
    return {
      queuePosition: position,
      estimatedWaitSeconds: Math.max(
        15,
        Math.ceil(position / WORKER_CONCURRENCY) * AVG_JOB_DURATION_SECONDS
      ),
      scheduledStartAt: null,
      isDelayed: false,
    }
  }

  if (state === 'active') {
    return {
      queuePosition: 1,
      estimatedWaitSeconds: AVG_JOB_DURATION_SECONDS,
      scheduledStartAt: null,
      isDelayed: false,
    }
  }

  return null
}

export function computeEnqueueDelay(
  rateLimitRetryAfterSeconds: number,
  workerEstimate: QueueEstimate
): { delayMs: number; estimatedWaitSeconds: number; queuePosition: number; scheduledStartAt: string | null } {
  const workerWait = workerEstimate.estimatedWaitSeconds
  const rateWait = rateLimitRetryAfterSeconds
  const estimatedWaitSeconds = Math.max(rateWait, workerWait)
  const delayMs = rateWait > 0 ? rateWait * 1000 : 0
  const queuePosition =
    workerEstimate.waitingJobs + workerEstimate.delayedJobs + workerEstimate.activeJobs + 1
  const scheduledStartAt =
    delayMs > 0 ? new Date(Date.now() + delayMs).toISOString() : null

  return { delayMs, estimatedWaitSeconds, queuePosition, scheduledStartAt }
}
