import { Worker } from 'bullmq'
import { prisma } from '../db'
import { runAudit } from '../audit/runner'
import { getWorkerRedisConnectionOptions } from './redis'

export function startWorker() {
  const worker = new Worker(
    'audit',
    async (job) => {
      const { auditId } = job.data as { auditId: string }
      try {
        await runAudit(auditId)
      } catch (err) {
        const audit = await prisma.audit.findUnique({
          where: { id: auditId },
          select: { status: true },
        })
        if (audit && audit.status !== 'FAILED' && audit.status !== 'COMPLETED') {
          await prisma.audit.update({
            where: { id: auditId },
            data: {
              status: 'FAILED',
              errorMsg: (err as Error).message || 'Audit failed unexpectedly',
            },
          })
        }
        throw err
      }
    },
    {
      connection: getWorkerRedisConnectionOptions(),
      concurrency: 3,
    }
  )

  worker.on('completed', (job) => {
    console.log(`Audit job ${job.id} completed for audit ${job.data.auditId}`)
  })

  worker.on('failed', async (job, err) => {
    console.error(`Audit job ${job?.id} failed:`, err)
    if (!job) return

    const attempts = job.opts.attempts ?? 1
    if (job.attemptsMade >= attempts) {
      const auditId = (job.data as { auditId: string }).auditId
      await prisma.audit.updateMany({
        where: {
          id: auditId,
          status: { notIn: ['COMPLETED', 'FAILED'] },
        },
        data: {
          status: 'FAILED',
          errorMsg: err.message || 'Audit failed after all retry attempts',
        },
      })
    }
  })

  return worker
}
