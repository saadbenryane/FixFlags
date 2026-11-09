import { prisma } from '@/lib/db'
import { createOwnedWorker } from '@/lib/queue/bullmq-ownership'
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
import { persistTaskPlan, reconcileTasks, dispatchReadyTasks, executeTask, continueTaskGraph, recoverProgressiveTasks, recoverInterruptedTaskDelivery } from './engine'
import { TASK_QUEUES } from './queues'
import { recordProgress } from './events'
import { ADVERTISED_COVERAGE_REGISTRY } from '../advertised-coverage'
import { closeParserWorker } from './cpu'
import { recoverPendingAiReviews } from '../enqueue-ai-review'
import { claimProgressiveRecovery, selectProgressiveRecovery } from './recovery-claim'

const handlers = registerTaskHandlers([...collectionHandlers, ...evaluatorHandlers, ...actionHandlers, ...lifecycleHandlers, ...accountHandlers])
for (const coverage of ADVERTISED_COVERAGE_REGISTRY.values()) for (const evaluator of coverage.evaluators) {
  if (evaluator.startsWith('task:') && !handlers.has(evaluator.slice(5) as Parameters<typeof handlers.has>[0]))
    throw new Error('Advertised task evaluator is not registered: ' + evaluator)
}

async function admitProgressiveGraph(auditId: string) {
  const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, select: { status: true, executionSpec: true } })
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
    if (!await prisma.auditExecutionTask.findFirst({ where: { auditId }, select: { id: true } })) {
      const plans = initialTaskPlan(spec)
      for (const plan of plans) if (!handlers.has(plan.kind)) throw new Error('Missing task evaluator: ' + plan.kind)
      await persistTaskPlan(auditId, plans)
    }
  })
  return true
}

/** The Audit job admits a graph, then offers ready work to its resource queues. */
export async function coordinateProgressiveAudit(auditId: string): Promise<void> {
  if (await admitProgressiveGraph(auditId)) await dispatchReadyTasks(await reconcileTasks(auditId))
}

export async function recoverPendingCoordinators(limit = 25) {
  const dueAt = new Date()
  const audits = await selectProgressiveRecovery('coordinator', dueAt, limit)
  const deadline = Date.now() + 10_000
  for (const { id: auditId } of audits) {
    if (Date.now() >= deadline) break
    try {
      if (await claimProgressiveRecovery('coordinator', dueAt, auditId))
        await admitProgressiveGraph(auditId)
    }
    catch (error) { logger.error('Audit coordination interrupted; retained admission will be retried', error, { auditId }) }
  }
}

export async function recoverProgressiveAudits(limit = 25) {
  const [result] = await Promise.all([
    recoverProgressiveTasks(limit),
    recoverPendingCoordinators(limit).catch(error => logger.error('Progressive admission sweep failed; existing graphs remain recoverable', error)),
    recoverPendingAiReviews(limit).catch(error => logger.error('Prescription handoff sweep interrupted; existing tasks remain recoverable', error)),
  ])
  return result
}

export function startProgressiveWorkers() {
  let activeTasks = 0
  const continuations = new Set<Promise<void>>()
  // Recorded observations release their physical queue slots. The same graph
  // coordinator continues immediately under the worker runtime's ownership.
  function continueExecution(auditId: string) {
    const pending = continueTaskGraph(auditId)
      .catch(error => logger.error('Task graph continuation interrupted; durable work remains recoverable', error, { auditId }))
      .finally(() => { continuations.delete(pending) })
    continuations.add(pending)
  }
  const workers = Object.entries(TASK_QUEUES).map(([resource, config]) => {
    const worker = createOwnedWorker(config.name, async job => {
      activeTasks++
      try { return await executeTask(job.data, handlers, continueExecution) }
      finally { activeTasks-- }
    }, {
      concurrency: config.concurrency, lockDuration: 90_000, maxStalledCount: 0,
    })
    worker.on('error', error => logger.error('Execution task worker error', { resource, message: error.message }))
    worker.on('failed', (job, error) => {
      logger.warn('Task delivery interrupted; ledger recovery owns retry',
        { resource, taskId: job?.data?.taskId, message: error.message })
      // Dispatch otherwise leaves the unclaimed task quiet for half a minute.
      void recoverInterruptedTaskDelivery(job).catch(writeError => logger.error('Interrupted task could not be requeued', writeError,
        { resource, taskId: job?.data?.taskId }))
    })
    return worker
  })
  let closing: Promise<void> | undefined
  return { activeCount: () => activeTasks, waitUntilReady: () => Promise.all(workers.map(worker => worker.waitUntilReady())), close: () => closing ??= (async () => {
    await Promise.all(workers.map(worker => worker.close()))
    // No worker can add another continuation after its graceful close. Finish
    // admitted publication before parser and shared producer teardown.
    await Promise.all([...continuations])
    await closeParserWorker()
  })() }
}
