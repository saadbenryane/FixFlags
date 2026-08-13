import { Worker, UnrecoverableError } from 'bullmq'
import { prisma } from '../db'
import { runAudit } from '../audit/runner'
import { runAiReview } from '../audit/run-ai-review'
import { runRepoScan } from '../repo-scan/runner'
import { runFixPr } from '../repo-scan/fix-pr-runner'
import { createWorkerRedis } from './redis'
import { recordStalledJob, touchWorkerHeartbeat } from './worker-heartbeat'
import { AUDIT_DEADLINE_MS } from '../audit/pipeline-config'
import { isNonRetryableAuditError } from '../audit/pipeline-errors'
import { logger } from '../logger'
import { WORKER_CONCURRENCY } from './estimate'
import { getBrowserDiagnostics } from '../audit/screenshot'
import { runBestEffort } from '../observability/best-effort'

const HEARTBEAT_INTERVAL_MS = 20_000

function workerBrowserDiagnostics() {
  const browser = getBrowserDiagnostics()
  return {
    browserOk: browser.connected,
    activeBrowserContexts: browser.activeContexts,
  }
}

export function startWorker() {
  void runBestEffort(
    () => touchWorkerHeartbeat(workerBrowserDiagnostics()),
    { operation: 'worker_heartbeat', logger, context: { phase: 'startup' } },
  )

  const heartbeatTimer = setInterval(() => {
    void runBestEffort(
      () => touchWorkerHeartbeat(workerBrowserDiagnostics()),
      { operation: 'worker_heartbeat', logger, context: { phase: 'idle' } },
    )
  }, HEARTBEAT_INTERVAL_MS)
  heartbeatTimer.unref?.()

  const worker = new Worker(
    'audit',
    async (job) => {
      await touchWorkerHeartbeat(workerBrowserDiagnostics())
      if (job.name === 'repo-scan') {
        const { repoScanId } = job.data as { repoScanId: string }
        await runRepoScan(repoScanId)
        return
      }
      if (job.name === 'repo-fix-pr') {
        const { repoFixPrId } = job.data as { repoFixPrId: string }
        await runFixPr(repoFixPrId)
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
        const terminal = await prisma.audit.findUnique({
          where: { id: auditId },
          select: { status: true },
        })
        if (terminal && terminal.status !== 'COMPLETED' && terminal.status !== 'FAILED') {
          await prisma.audit.update({
            where: { id: auditId },
            data: {
              status: 'FAILED',
              errorMsg: 'Audit worker finished without a terminal report state',
              failureCode: 'AUDIT_JOB_NON_TERMINAL',
              failureStage: terminal.status.toLowerCase(),
              failureMetadata: { jobId: String(job.id) },
            },
          })
          throw new UnrecoverableError(
            `Audit ${auditId} finished in non-terminal state ${terminal.status}`
          )
        }
      } catch (err) {
        throw wrapAuditJobError(err)
      }
    },
    {
      connection: createWorkerRedis(),
      concurrency: WORKER_CONCURRENCY,
      lockDuration: AUDIT_DEADLINE_MS + 30_000,
      // Replaying an active Playwright scan deletes and recaptures evidence,
      // which makes the user-visible audit jump backwards. A stalled run fails
      // once and the explicit retry path starts a clean, observable attempt.
      maxStalledCount: 0,
    }
  )

  worker.on('completed', (job) => {
    void runBestEffort(
      () => touchWorkerHeartbeat(workerBrowserDiagnostics()),
      { operation: 'worker_heartbeat', logger, context: { phase: 'completed', jobId: String(job.id) } },
    )
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

    if (job.name === 'repo-fix-pr') {
      const { repoFixPrId } = job.data as { repoFixPrId: string }
      await prisma.repoFixPr.updateMany({
        where: { id: repoFixPrId, status: { not: 'CREATED' } },
        data: { status: 'FAILED', errorMsg: err.message || 'Fix PR creation failed' },
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

  worker.on('stalled', (jobId) => {
    void runBestEffort(
      recordStalledJob,
      { operation: 'worker_stalled_metric', logger, context: { jobId } },
    )
    logger.error(`Audit job ${jobId} stalled and will not be replayed`)
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
