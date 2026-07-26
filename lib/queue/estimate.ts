import { getAuditQueue } from '@/lib/queue/client'
import { readWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'

function parseWorkerConcurrency(): number {
  const raw = process.env.AUDIT_WORKER_CONCURRENCY
  if (!raw) return process.env.NODE_ENV === 'production' ? 2 : 1
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export const WORKER_CONCURRENCY = parseWorkerConcurrency()
export const AVG_JOB_DURATION_SECONDS = 30

export interface QueueEstimate {
  activeJobs: number
  waitingJobs: number
  delayedJobs: number
  workerCapacity: number
  availableCapacity: number
  jobsAhead: number
  queued: boolean
  estimatedWaitSeconds: number
}

export function estimateQueueState(input: {
  activeJobs: number
  waitingJobs: number
  delayedJobs?: number
  workerCapacity: number
}): QueueEstimate {
  const activeJobs = Math.max(0, input.activeJobs)
  const waitingJobs = Math.max(0, input.waitingJobs)
  const delayedJobs = Math.max(0, input.delayedJobs ?? 0)
  const workerCapacity = Math.max(0, input.workerCapacity)
  const availableCapacity = Math.max(0, workerCapacity - activeJobs)
  const queued = workerCapacity === 0 || waitingJobs >= availableCapacity
  const jobsAhead = queued ? activeJobs + waitingJobs : 0
  const estimatedWaitSeconds =
    queued && workerCapacity > 0
      ? Math.ceil((waitingJobs + 1) / workerCapacity) * AVG_JOB_DURATION_SECONDS
      : 0

  return {
    activeJobs,
    waitingJobs,
    delayedJobs,
    workerCapacity,
    availableCapacity,
    jobsAhead,
    queued,
    estimatedWaitSeconds,
  }
}

export async function getWorkerQueueEstimate(): Promise<QueueEstimate> {
  const queue = getAuditQueue()
  const [activeJobs, waitingJobs, delayedJobs, heartbeat] = await Promise.all([
    queue.getActiveCount(),
    queue.getWaitingCount(),
    queue.getDelayedCount(),
    readWorkerHeartbeat(),
  ])
  return estimateQueueState({
    activeJobs,
    waitingJobs,
    delayedJobs,
    workerCapacity:
      heartbeat.alive && heartbeat.browserOk
        ? heartbeat.configuredConcurrency
        : 0,
  })
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
): {
  delayMs: number
  estimatedWaitSeconds: number
  queuePosition: number
  scheduledStartAt: string | null
  queued: boolean
  queueReason?: 'rate_limit' | 'backlog'
  queue: {
    state: 'starting' | 'waiting' | 'rate_limited'
    jobsAhead: number
    estimatedStartSeconds: number
    scheduledStartAt?: string
  }
} {
  const workerWait = workerEstimate.estimatedWaitSeconds
  const rateWait = rateLimitRetryAfterSeconds
  const estimatedWaitSeconds = Math.max(rateWait, workerWait)
  const delayMs = rateWait > 0 ? rateWait * 1000 : 0
  const queued = rateWait > 0 || workerEstimate.queued
  const queuePosition = queued ? workerEstimate.jobsAhead : 0
  const scheduledStartAt =
    delayMs > 0 ? new Date(Date.now() + delayMs).toISOString() : null
  const state =
    rateWait > 0 ? 'rate_limited' : workerEstimate.queued ? 'waiting' : 'starting'

  return {
    delayMs,
    estimatedWaitSeconds,
    queuePosition,
    scheduledStartAt,
    queued,
    queueReason:
      rateWait > 0 ? 'rate_limit' : workerEstimate.queued ? 'backlog' : undefined,
    queue: {
      state,
      jobsAhead: queuePosition,
      estimatedStartSeconds: estimatedWaitSeconds,
      ...(scheduledStartAt ? { scheduledStartAt } : {}),
    },
  }
}
