import { Worker, UnrecoverableError } from 'bullmq'
import { prisma } from '../db'
import { runAudit } from '../audit/runner'
import { getWorkerRedisConnectionOptions } from './redis'
import { AUDIT_DEADLINE_MS } from '../audit/pipeline-config'
import { isNonRetryableAuditError } from '../audit/pipeline-errors'
import { logger } from '../logger'

export function startWorker() {
  const worker = new Worker(
    'audit',
    async (job) => {
      const { auditId } = job.data as { auditId: string }
      await runAudit(auditId)
    },
    {
      connection: getWorkerRedisConnectionOptions(),
      concurrency: 3,
      lockDuration: AUDIT_DEADLINE_MS + 30_000,
    }
  )

  worker.on('completed', (job) => {
    logger.info(`Audit job ${job.id} completed`, { auditId: job.data.auditId })
  })

  worker.on('failed', async (job, err) => {
    logger.error(`Audit job ${job?.id} failed`, err)
    if (!job) return

    const auditId = (job.data as { auditId: string }).auditId
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      select: { status: true },
    })
    if (audit?.status === 'FAILED' || audit?.status === 'COMPLETED') return

    const attempts = job.opts.attempts ?? 1
    if (job.attemptsMade >= attempts) {
      await prisma.audit.updateMany({
        where: {
          id: auditId,
          status: { notIn: ['COMPLETED', 'FAILED'] },
        },
        data: {
          status: 'FAILED',
          errorMsg: err.message || 'Audit failed after all retry attempts',
          failureCode: 'AUDIT_JOB_FAILED',
          failureStage: 'worker',
          failureMetadata: {
            attempts: job.attemptsMade,
            jobId: String(job.id),
          },
        },
      })
    }
  })

  return worker
}

export function wrapAuditJobError(error: unknown): Error {
  if (isNonRetryableAuditError(error)) {
    return new UnrecoverableError(
      error instanceof Error ? error.message : String(error)
    )
  }
  return error instanceof Error ? error : new Error(String(error))
}
