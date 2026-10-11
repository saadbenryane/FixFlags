import { prisma } from '@/lib/db'
import { Worker } from 'bullmq'
import { createWorkerRedis } from '@/lib/queue/redis'
import { WORKER_CONCURRENCY } from '@/lib/queue/estimate'
import { logger } from '@/lib/logger'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { claimExecution, withExecutionOwnership, executionTransaction } from '../execution-ownership'
import { initialTaskPlan, availabilityOnly } from './graph'
import { collectionHandlers } from './collectors'
import { evaluatorHandlers } from './evaluators'
import { lifecycleHandlers } from './lifecycle'
import { actionHandlers } from './actions'
import { registerTaskHandlers } from './registry'
import { loadTaskGraph, persistTaskPlan, reconcileTasks, dispatchReadyTasks, executeTask, recoverProgressiveTasks } from './engine'
import { TASK_QUEUES } from './queues'
import { recordProgress } from './events'
import { ADVERTISED_COVERAGE_REGISTRY } from '../advertised-coverage'

const handlers = registerTaskHandlers([...collectionHandlers, ...evaluatorHandlers, ...actionHandlers, ...lifecycleHandlers])
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
  const owner = await claimExecution(auditId, false, false, true)
  if (!owner) return
  await withExecutionOwnership(owner, async () => {
    const allowed = await executionTransaction(async tx => {
      // Short, cross-worker admission lock. Queued analyses keep their durable intent.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('progressive-analysis-admission'))`
      const active = await tx.audit.count({ where: { id: { not: auditId }, startedAt: { not: null },
        status: { notIn: ['COMPLETED', 'FAILED'] }, executionSpec: { path: ['engine'], equals: 'progressive-v1' },
        OR: [{ verifierExecutions: { some: { workState: { in: ['READY', 'RUNNING'] } } } },
          { verifierExecutions: { none: { workKind: { not: null } } } }],
      } })
      if (!audit.startedAt && active >= WORKER_CONCURRENCY && !availabilityOnly(spec)) return false
      if (!audit.startedAt) {
        await tx.audit.update({ where: { id: auditId }, data: { startedAt: new Date(), status: 'CAPTURING', progress: 0 } })
        await recordProgress(tx, auditId, { kind: 'analysis', state: 'started' })
      }
      return true
    })
    if (!allowed) return
    if (!(await loadTaskGraph(auditId)).length) {
      const plans = initialTaskPlan(spec)
      for (const plan of plans) if (!handlers.has(plan.kind)) throw new Error('Missing task evaluator: ' + plan.kind)
      await persistTaskPlan(auditId, plans)
    }
  })
  await dispatchReadyTasks(await reconcileTasks(auditId))
}

export async function recoverProgressiveAudits(limit = 25) {
  const pending = await prisma.audit.findMany({ where: {
    status: { notIn: ['COMPLETED', 'FAILED'] }, executionSpec: { path: ['engine'], equals: 'progressive-v1' },
    verifierExecutions: { none: { workKind: { not: null } } },
    dispatchNextAt: { lte: new Date() },
  }, orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }], take: Math.min(100, Math.max(1, limit)), select: { id: true } })
  for (const audit of pending) await coordinateProgressiveAudit(audit.id)
  return recoverProgressiveTasks(limit)
}

export function startProgressiveWorkers() {
  const workers = Object.entries(TASK_QUEUES).map(([resource, config]) => {
    const worker = new Worker(config.name, job => executeTask(job.data, handlers), {
      connection: createWorkerRedis(), concurrency: config.concurrency, lockDuration: 90_000, maxStalledCount: 0,
    })
    worker.on('error', error => logger.error('Execution task worker error', { resource, message: error.message }))
    worker.on('failed', (job, error) => logger.warn('Task delivery interrupted; ledger recovery owns retry',
      { resource, taskId: job?.data.taskId, message: error.message }))
    return worker
  })
  return { close: () => Promise.all(workers.map(worker => worker.close())) }
}
