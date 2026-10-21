import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { executionTransaction } from '../execution-ownership'
import { getAuditTaskQueue } from '@/lib/queue/client'
import { logger } from '@/lib/logger'
import { COMPLETION_TASK_KINDS, runsAfterCompletion, taskInputSchema, taskIsSettled, taskJobSchema, type TaskKind } from './contracts'
import { deliveryResourceSql, queueForTask, taskDeliveryWindow, TASK_QUEUES, type TaskQueue } from './queues'

export const DELIVERY_RECHECK_MS = 30_000
const select = { id: true, auditId: true, workKind: true, workInput: true, workState: true, workGeneration: true,
  workDispatchState: true, workDispatchLeaseUntil: true, workRetryAt: true, workAttempts: true, workRecoveryUntil: true } as const

/** Bounded reservation projection, without transferring task artifacts. */
export function reservedDeliveryQuery(resource: TaskQueue, taskId: string, now: Date) {
  return Prisma.sql`
    SELECT delivery.id FROM audit_verifier_executions delivery JOIN audits a ON a.id = delivery."auditId"
    WHERE delivery."targetKey" LIKE 'task:%' AND delivery.id <> ${taskId}
      AND (delivery."workState" = 'RUNNING' OR (delivery."workState" = 'READY'
        AND (delivery."workDispatchState" IN ('SENT', 'FAILED') OR delivery."workDispatchLeaseUntil" IS NOT NULL)))
      AND (delivery."workState" = 'RUNNING' OR delivery."workDispatchState" IN ('SENT', 'FAILED') OR delivery."workDispatchLeaseUntil" > ${now})
      AND a.status <> 'FAILED' AND (a.status <> 'COMPLETED' OR delivery."workKind" IN (${Prisma.join([...COMPLETION_TASK_KINDS])}))
      AND (${deliveryResourceSql}) = ${resource} LIMIT ${taskDeliveryWindow(resource)}`
}

/** Reserve delivery before contacting Redis. A lost acknowledgement retains its
 * existing reservation until reconciliation can inspect the same generation. */
export async function claimTaskDelivery(taskId: string) {
  const candidate = await prisma.auditVerifierExecution.findUnique({ where: { id: taskId }, select })
  if (!candidate?.workKind || candidate.workState !== 'READY') return null
  const resource = queueForTask(candidate.workKind as TaskKind, taskInputSchema.parse(candidate.workInput))
  return executionTransaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'task-delivery:' + resource}))`
    const task = await tx.auditVerifierExecution.findUnique({ where: { id: taskId }, select })
    if (!task?.workKind || task.workState !== 'READY') return null
    const input = taskInputSchema.parse(task.workInput), now = new Date()
    if (queueForTask(task.workKind as TaskKind, input) !== resource ||
      task.workDispatchLeaseUntil && task.workDispatchLeaseUntil > now || task.workRetryAt && task.workRetryAt > now) return null
    const where = { id: task.id, workGeneration: task.workGeneration, workState: 'READY' as const,
      workDispatchState: task.workDispatchState, workRetryAt: task.workRetryAt,
      workDispatchLeaseUntil: task.workDispatchLeaseUntil,
      audit: { status: { not: 'FAILED' as const } },
      OR: [{ audit: { status: { not: 'COMPLETED' as const } } }, { workKind: { in: [...COMPLETION_TASK_KINDS] } }],
    }
    const reserved = task.workDispatchState === 'SENT' || task.workDispatchState === 'FAILED'
    if (!reserved) {
      const occupied = await tx.$queryRaw<Array<{ id: string }>>(reservedDeliveryQuery(resource, task.id, now))
      if (occupied.length >= taskDeliveryWindow(resource)) {
        // Rotate saturated work so another resource in this graph can progress.
        // Waiting for delivery capacity is neither an attempt nor a failure.
        await tx.auditVerifierExecution.updateMany({ where, data: { workRetryAt: now } })
        return null
      }
    }
    const lease = new Date(now.getTime() + DELIVERY_RECHECK_MS)
    const claimed = await tx.auditVerifierExecution.updateMany({ where,
      data: { workDispatchLeaseUntil: lease, workDispatchState: 'FAILED' } })
    return claimed.count === 1 ? { task, input, resource, lease } : null
  })
}

/** Inspect actual queued deliveries, including orphaned records and late
 * producer acknowledgements. The database remains the execution authority;
 * cleanup never changes an observation, task verdict or retry obligation. */
export async function retireObsoleteTaskDeliveries(limit = 25): Promise<void> {
  const bound = Math.min(100, Math.max(1, Math.floor(limit)))
  const resources = Object.keys(TASK_QUEUES) as TaskQueue[]
  const passes = await Promise.allSettled(resources.map(async resource => {
    const deadline = Date.now() + 5000
    const queue = getAuditTaskQueue(resource)
    // Look past a whole live delivery window, so paused valid work cannot
    // conceal retired deliveries behind it. No durable sweep cursor is needed.
    const jobs = await queue.getJobs(['waiting', 'paused', 'prioritized', 'delayed', 'waiting-children'],
      0, taskDeliveryWindow(resource) + bound - 1, true)
    const deliveries = [...new Map(jobs.flatMap(job => {
      const parsed = taskJobSchema.safeParse(job?.data)
      return parsed.success && job.id === parsed.data.taskId + '-g' + parsed.data.generation
        ? [[job.id, { job, intent: parsed.data }] as const] : []
    })).values()]
    if (!deliveries.length) return
    const records = await prisma.auditVerifierExecution.findMany({ where: { id: { in: deliveries.map(item => item.intent.taskId) } },
      select: { id: true, auditId: true, workKind: true, workState: true, workGeneration: true, audit: { select: { status: true } } } })
    const byId = new Map(records.map(record => [record.id, record]))
    const retired = deliveries.filter(({ intent }) => {
      const task = byId.get(intent.taskId)
      return !task || task.auditId !== intent.auditId || task.workGeneration !== intent.generation - 1 || taskIsSettled(task.workState) ||
        task.audit.status === 'FAILED' || task.audit.status === 'COMPLETED' && !runsAfterCompletion(task.workKind)
    }).slice(0, bound)
    for (let offset = 0; offset < retired.length && Date.now() < deadline; offset += 4) {
      const results = await Promise.allSettled(retired.slice(offset, offset + 4).map(async ({ job }) => {
        const state = await job.getState()
        if (state === 'active' || state === 'completed' || state === 'failed' || state === 'unknown') return
        // BullMQ's atomic removal refuses a job claimed after our read.
        // Never recursively remove another task's dependencies or children.
        await job.remove({ removeChildren: false })
      }))
      for (const result of results) if (result.status === 'rejected')
        logger.warn('Obsolete task delivery retained for a later cleanup pass', { resource, error: result.reason })
    }
  }))
  passes.forEach((result, index) => {
    if (result.status === 'rejected') logger.warn('Task delivery cleanup deferred; independent resources will continue',
      { resource: resources[index], error: result.reason })
  })
}
