import { Queue, Worker } from 'bullmq'
import { z } from 'zod'
import { createQueueRedis, createWorkerRedis } from '@/lib/queue/redis'
import { logger } from '@/lib/logger'

export const uptimeJobSchema = z.object({
  monitorId: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(100),
  version: z.number().int().positive(),
  scheduledAt: z.string().datetime(),
  attempt: z.union([z.literal(1), z.literal(2)]),
}).strict()
export type UptimeJob = z.infer<typeof uptimeJobSchema>

let queue: Queue | undefined
let producerRedis: ReturnType<typeof createQueueRedis> | undefined
function getQueue() {
  if (!queue) {
    producerRedis = createQueueRedis()
    queue = new Queue('uptime-probes', { connection: producerRedis,
      defaultJobOptions: { attempts: 2, backoff: { type: 'fixed', delay: 5000 },
        removeOnComplete: { age: 86400, count: 20_000 }, removeOnFail: { age: 7 * 86400, count: 20_000 } } })
    queue.on('error', error => logger.error('Uptime queue unavailable', error))
  }
  return queue
}

export function uptimeJobId(input: UptimeJob) {
  return `${input.monitorId}-${input.version}-${Date.parse(input.scheduledAt)}-${input.attempt}`
}

export async function enqueueUptimeProbe(input: UptimeJob, dueAt: Date) {
  const job = uptimeJobSchema.parse(input)
  const queued = await getQueue().add('probe', job, { jobId: uptimeJobId(job), delay: Math.max(0, dueAt.getTime() - Date.now()) })
  // A retained terminal job can outlive its worker interruption or abandoned lease.
  // The scheduler's persisted due state authorizes replay; the worker still owns observation deduplication.
  if (dueAt.getTime() <= Date.now()) {
    const state = await queued.getState()
    if (state === 'failed' || state === 'completed')
      await queued.retry(state, { resetAttemptsMade: true, resetAttemptsStarted: true })
  }
}

export function startUptimeWorker(processProbe: (job: UptimeJob) => Promise<void>) {
  const connection = createWorkerRedis()
  const worker = new Worker('uptime-probes', job => processProbe(uptimeJobSchema.parse(job.data)), {
    connection, concurrency: 4, lockDuration: 30_000, maxStalledCount: 1,
  })
  worker.on('error', error => logger.error('Uptime worker unavailable', error))
  worker.on('failed', (job, error) => logger.error('Uptime probe job failed', { jobId: job?.id, error: error.message }))
  return {
    close: async (pendingMaintenance: Promise<unknown> = Promise.resolve()) => {
      // Stop intake now, but keep the producer usable until admitted dispatches finish.
      await Promise.all([worker.close(), pendingMaintenance])
      await connection.quit()
      await queue?.close()
      await producerRedis?.quit()
      queue = undefined; producerRedis = undefined
    },
  }
}
