import { Worker } from 'bullmq'
import { runAudit } from '../audit/runner'

function getRedisOptions() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379'
  return {
    url: url.includes('?') ? url : `${url}?family=0`,
    maxRetriesPerRequest: null as unknown as undefined,
    enableReadyCheck: false,
  }
}

export function startWorker() {
  const worker = new Worker(
    'audit',
    async (job) => {
      const { auditId } = job.data
      await runAudit(auditId)
    },
    {
      connection: getRedisOptions(),
      concurrency: 3,
    }
  )

  worker.on('completed', (job) => {
    console.log(`Audit job ${job.id} completed for audit ${job.data.auditId}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Audit job ${job?.id} failed:`, err)
  })

  return worker
}
