import { prisma } from '@/lib/db'
import { Worker } from 'bullmq'
import { createWorkerRedis } from '@/lib/queue/redis'
import { logger } from '@/lib/logger'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { claimExecution, withExecutionOwnership, executionTransaction } from '../execution-ownership'
import { initialTaskPlan } from './graph'
import { collectionHandlers } from './collectors'
import { evaluatorHandlers } from './evaluators'
import { lifecycleHandlers } from './lifecycle'
import { accountHandlers } from './accounts'
import { actionHandlers } from './actions'
import { registerTaskHandlers } from './registry'
import { loadTaskGraph, persistTaskPlan, reconcileTasks, dispatchReadyTasks, executeTask, recoverProgressiveTasks } from './engine'
import { TASK_QUEUES } from './queues'
import { recordProgress } from './events'
import { ADVERTISED_COVERAGE_REGISTRY } from '../advertised-coverage'
import { closeParserWorker } from './cpu'
import { recoverPendingAiReviews } from '../enqueue-ai-review'

const handlers = registerTaskHandlers([...collectionHandlers, ...evaluatorHandlers, ...actionHandlers, ...lifecycleHandlers, ...accountHandlers])
for (const coverage of ADVERTISED_COVERAGE_REGISTRY.values()) for (const evaluator of coverage.evaluators) {
  if (evaluator.startsWith('task:') && !handlers.has(evaluator.slice(5) as Parameters<typeof handlers.has>[0]))
    throw new Error('Advertised task evaluator is not registered: ' + evaluator)
}

/** The Audit job admits a graph and returns. Physical work has separate, fenced
 * checkpoints and resource queues; a completed coordinator is not a completed analysis. */
export async function coordinateProgressiveAudit(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
  const spec = readExecutionSpec(audit.executionSpec)
  if (!spec || spec.engine !== 'progressive-v1' || ['COMPLETED', 'FAILED'].includes(audit.status)) return
  const owner = await claimExecution(auditId, { resume: true })
  if (!owner) return
  await withExecutionOwnership(owner, async () => {
    await executionTransaction(async tx => {
      const started = await tx.audit.updateMany({ where: { id: auditId, startedAt: null, status: { notIn: ['COMPLETED', 'FAILED'] } },
        data: { startedAt: new Date(), status: 'CAPTURING', progress: 0 } })
      if (started.count) {
        await recordProgress(tx, auditId, { kind: 'analysis', state: 'started' })
      }
    })
    if (!(await loadTaskGraph(auditId)).length) {
      const plans = initialTaskPlan(spec)
      for (const plan of plans) if (!handlers.has(plan.kind)) throw new Error('Missing task evaluator: ' + plan.kind)
      await persistTaskPlan(auditId, plans)
    }
  })
  await dispatchReadyTasks(await reconcileTasks(auditId))
}

export async function recoverProgressiveAudits(limit = 25) {
  await recoverPendingAiReviews(limit).catch(error => logger.error('Prescription handoff sweep interrupted; existing tasks remain recoverable', error))
  const now = new Date()
  const pending = await prisma.audit.findMany({ where: {
    status: { notIn: ['COMPLETED', 'FAILED'] }, executionSpec: { path: ['engine'], equals: 'progressive-v1' },
    verifierExecutions: { none: { workKind: { not: null } } },
    dispatchNextAt: { lte: now },
  }, orderBy: [{ dispatchNextAt: 'asc' }, { id: 'asc' }], take: Math.min(100, Math.max(1, limit)), select: { id: true, dispatchNextAt: true } })
    .catch(error => { logger.error('Progressive admission sweep failed; existing graphs remain recoverable', error); return [] })
  for (const audit of pending) {
    try {
      // Rotate attempted admissions before reading their graph. Interrupted
      // reads and capacity waits cannot monopolize the next bounded pass.
      const admitted = await prisma.audit.updateMany({ where: { id: audit.id, dispatchNextAt: audit.dispatchNextAt,
        status: { notIn: ['COMPLETED', 'FAILED'] }, executionSpec: { path: ['engine'], equals: 'progressive-v1' },
        verifierExecutions: { none: { workKind: { not: null } } } },
      data: { dispatchNextAt: new Date(now.getTime() + 10_000) } })
      if (admitted.count) await coordinateProgressiveAudit(audit.id)
    }
    catch (error) { logger.error('Audit coordination interrupted; retained admission will be retried', error, { auditId: audit.id }) }
  }
  return recoverProgressiveTasks(limit)
}

export function startProgressiveWorkers() {
  const workers = Object.entries(TASK_QUEUES).map(([resource, config]) => {
    const worker = new Worker(config.name, job => executeTask(job.data, handlers), {
      connection: createWorkerRedis(), concurrency: config.concurrency, lockDuration: 90_000, maxStalledCount: 0,
    })
    worker.on('error', error => logger.error('Execution task worker error', { resource, message: error.message }))
    worker.on('failed', (job, error) => {
      logger.warn('Task delivery interrupted; ledger recovery owns retry',
        { resource, taskId: job?.data.taskId, message: error.message })
      const taskId = job?.data?.taskId
      if (typeof taskId !== 'string') return
      // Dispatch otherwise leaves the unclaimed task quiet for half a minute.
      void prisma.auditVerifierExecution.updateMany({
        where: { id: taskId, workState: 'READY', workDispatchState: 'SENT' },
        data: { workDispatchState: 'PENDING', workRetryAt: new Date(Date.now() + 1000) },
      }).catch(writeError => logger.error('Interrupted task could not be requeued', writeError, { resource, taskId }))
    })
    return worker
  })
  return { close: async () => {
    await Promise.all(workers.map(worker => worker.close()))
    await closeParserWorker()
  } }
}
