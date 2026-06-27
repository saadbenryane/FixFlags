import { Worker, UnrecoverableError } from 'bullmq'
import { prisma } from '../db'
import { runAudit } from '../audit/runner'
import { runAiReview } from '../audit/run-ai-review'
import { runRepoScan } from '../repo-scan/runner'
import { createWorkerRedis } from './redis'
import { touchWorkerHeartbeat } from './worker-heartbeat'
import { AUDIT_DEADLINE_MS } from '../audit/pipeline-config'
import { isNonRetryableAuditError } from '../audit/pipeline-errors'
import { logger } from '../logger'

const HEARTBEAT_INTERVAL_MS = 20_000

function parseWorkerConcurrency(): number {
  const raw = process.env.AUDIT_WORKER_CONCURRENCY
  if (!raw) return 5
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5
}

export function startWorker() {
  void touchWorkerHeartbeat().catch((err) => {
    logger.error('Initial worker heartbeat failed', err)
  })

  const heartbeatTimer = setInterval(() => {
    void touchWorkerHeartbeat().catch(() => {})
  }, HEARTBEAT_INTERVAL_MS)
  heartbeatTimer.unref?.()

  const worker = new Worker(
    'audit',
    async (job) => {
      await touchWorkerHeartbeat()
      if (job.name === 'repo-scan') {
        const { repoScanId } = job.data as { repoScanId: string }
        await runRepoScan(repoScanId)
        return
      }
      try {
        if (job.name === 'ai-review') {
          const { auditId } = job.data as { auditId: string }
          await runAiReview(auditId)
          return
        }
        const { auditId } = job.data as { auditId: string }
        await runAudit(auditId)
      } catch (err) {
        throw wrapAuditJobError(err)
      }
    },
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connection: createWorkerRedis() as any,
      concurrency: parseWorkerConcurrency(),
      lockDuration: AUDIT_DEADLINE_MS + 30_000,
    }
  )

  worker.on('completed', (job) => {
    void touchWorkerHeartbeat().catch(() => {})
    logger.info(`Audit job ${job.id} completed`, { auditId: job.data.auditId })
  })

  worker.on('failed', async (job, err) => {
    logger.error(`Audit job ${job?.id} failed`, err)
    if (!job) return
    if (job.name === 'repo-scan') {
      const { repoScanId } = job.data as { repoScanId: string }
      await prisma.repoScan.updateMany({
        where: { id: repoScanId, status: { notIn: ['COMPLETED', 'FAILED'] } },
        data: { status: 'FAILED', errorMsg: err.message || 'Repo scan failed', completedAt: new Date() },
      })
      return
    }

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
