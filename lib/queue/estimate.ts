import { getAdminOperationQueue, getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { readWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { TASK_QUEUES, type TaskQueue } from '@/lib/audit/progressive/queues'

/** Operational work includes bootstrap, progressive execution and administrative work. */
export async function getWorkerExecutionCounts(): Promise<{ activeJobs: number; waitingJobs: number; delayedJobs: number }> {
  const queues = [getAuditQueue(), ...(Object.keys(TASK_QUEUES) as TaskQueue[]).map(getAuditTaskQueue), getAdminOperationQueue()]
  const counts = await Promise.all(queues.map(async queue => {
    const [activeJobs, waitingJobs, prioritizedJobs, delayedJobs] = await Promise.all([
      queue.getActiveCount(), queue.getWaitingCount(), queue.getPrioritizedCount(), queue.getDelayedCount(),
    ])
    return { activeJobs, waitingJobs: waitingJobs + prioritizedJobs, delayedJobs }
  }))
  return counts.reduce((total, count) => ({
    activeJobs: total.activeJobs + count.activeJobs,
    waitingJobs: total.waitingJobs + count.waitingJobs,
    delayedJobs: total.delayedJobs + count.delayedJobs,
  }), { activeJobs: 0, waitingJobs: 0, delayedJobs: 0 })
}

function parseWorkerConcurrency(): number {
  const raw = process.env.AUDIT_WORKER_CONCURRENCY
  if (!raw) return process.env.NODE_ENV === 'production' ? 2 : 1
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 64) throw new Error('AUDIT_WORKER_CONCURRENCY must be an integer between 1 and 64')
  return parsed
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
  estimatedWaitSeconds: number | null
  workerAvailable: boolean
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
  const workerAvailable = workerCapacity > 0
  const estimatedWaitSeconds = !workerAvailable
    ? null
    : queued
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
    workerAvailable,
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

export type QueueState = 'starting' | 'waiting' | 'rate_limited' | 'delayed' | 'active'

export interface QueueStatus {
  state: QueueState
  jobsAhead: number
  estimatedWaitSeconds: number | null
  scheduledStartAt: string | null
  workerAvailable: boolean
}

export function computeEnqueueDelay(
  rateLimitRetryAfterSeconds: number,
  workerEstimate: QueueEstimate
): {
  delayMs: number
  queued: boolean
  queueReason?: 'rate_limit' | 'backlog'
  queue: QueueStatus
} {
  const workerWait = workerEstimate.estimatedWaitSeconds ?? 0
  const rateWait = rateLimitRetryAfterSeconds
  const estimatedWaitSeconds = workerEstimate.workerAvailable
    ? Math.max(rateWait, workerWait)
    : null
  const delayMs = rateWait > 0 ? rateWait * 1000 : 0
  const queued = rateWait > 0 || workerEstimate.queued
  const jobsAhead = queued ? workerEstimate.jobsAhead : 0
  const scheduledStartAt =
    delayMs > 0 ? new Date(Date.now() + delayMs).toISOString() : null
  const state =
    rateWait > 0 ? 'rate_limited' : workerEstimate.queued ? 'waiting' : 'starting'

  return {
    delayMs,
    queued,
    queueReason:
      rateWait > 0 ? 'rate_limit' : workerEstimate.queued ? 'backlog' : undefined,
    queue: {
      state,
      jobsAhead,
      estimatedWaitSeconds,
      scheduledStartAt,
      workerAvailable: workerEstimate.workerAvailable,
    },
  }
}
