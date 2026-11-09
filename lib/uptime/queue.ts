import { z } from 'zod'
import { ErrorCode } from 'bullmq'
import { createQueueProducer, createOwnedWorker } from '@/lib/queue/bullmq-ownership'
import { logger } from '@/lib/logger'

export const uptimeJobSchema = z.object({
  monitorId: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(100),
  version: z.number().int().positive(),
  scheduledAt: z.string().datetime(),
  attempt: z.union([z.literal(1), z.literal(2)]),
}).strict()
export type UptimeJob = z.infer<typeof uptimeJobSchema>

const producer = createQueueProducer('uptime-probes', {
  defaultJobOptions: { attempts: 2, backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: { age: 86400, count: 20_000 }, removeOnFail: { age: 7 * 86400, count: 20_000 } },
  onError: error => logger.error('Uptime queue unavailable', error),
})

export function uptimeJobId(input: UptimeJob) {
  return `${input.monitorId}-${input.version}-${Date.parse(input.scheduledAt)}-${input.attempt}`
}

export async function enqueueUptimeProbe(input: UptimeJob, dueAt: Date) {
  const job = uptimeJobSchema.parse(input)
  const queued = await producer.get().add('probe', job, {
    jobId: uptimeJobId(job), delay: Math.max(0, dueAt.getTime() - Date.now()),
    // BullMQ takes ready jobs with priority zero first. A confirmation has a
    // finite evidence window, so give it the next lane ahead of routine probes.
    priority: job.attempt === 2 ? 0 : 1,
  })
  // A retained terminal job can outlive its worker interruption or abandoned lease.
  // The scheduler's persisted due state authorizes replay; the worker still owns observation deduplication.
  if (dueAt.getTime() <= Date.now()) {
    const state = await queued.getState()
    if (state === 'failed' || state === 'completed') {
      try {
        await queued.retry(state, { resetAttemptsMade: true, resetAttemptsStarted: true })
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== ErrorCode.JobNotInState) throw error
        // Another publisher may have moved this retained job first. Verify the
        // current broker state before treating the losing retry as delivered.
        const current = await queued.getState()
        if (!['waiting', 'active', 'delayed', 'prioritized', 'completed'].includes(current)) throw error
      }
    }
  }
}

export function startUptimeWorker(processProbe: (job: UptimeJob) => Promise<void>) {
  const worker = createOwnedWorker('uptime-probes', job => processProbe(uptimeJobSchema.parse(job.data)), {
    concurrency: 4, lockDuration: 30_000, maxStalledCount: 1,
  })
  worker.on('error', error => logger.error('Uptime worker unavailable', error))
  worker.on('failed', (job, error) => logger.error('Uptime probe job failed', { jobId: job?.id, error: error.message }))
  type Connection = Awaited<ReturnType<typeof worker.waitUntilReady>>
  let connections: [Connection, Connection] | undefined
  const ready = Promise.all([worker.client, worker.waitUntilReady()]).then(clients => {
    connections = clients
    return clients[1]
  })
  // The public readiness wait still reports initialization failure.
  void ready.catch(() => undefined)
  let closing: Promise<void> | undefined
  const canConsume = () => !closing && worker.isRunning() && !worker.isPaused() &&
    connections?.every(client => client.status === 'ready') === true
  return {
    waitUntilReady: () => ready,
    async checkReady() {
      // A bounded producer read checks the queue's shared pause state and
      // confirms broker access even when the scheduler found no work.
      return canConsume() && !await producer.get().isPaused() && canConsume()
    },
    close: (pendingMaintenance: Promise<unknown> = Promise.resolve()) => closing ??= (async () => {
      // Stop intake now, but keep the producer usable until admitted dispatches finish.
      await Promise.all([worker.close(), pendingMaintenance])
      await producer.close()
    })(),
  }
}
