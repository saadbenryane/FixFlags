import { analysisRecoveryEndsAt } from './recovery-window'
import { randomUUID } from 'node:crypto'
import { Prisma, type AuditExecutionTask } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ScanAccessUnavailable } from '../scan-access-grants'
import { scopeTaskArtifact } from './results'
import { getAuditTaskQueue } from '@/lib/queue/client'
import { DELIVERY_RECHECK_MS, queueForTask, priorityForTask } from './queues'
import { logUnrecordedPrescriptionCost, publishUnfinishedCoverage, recordSettledPrescriptionCost, settleFailedFinalization, settlePrescriptionAudit } from './incomplete'
import { executionTransaction, lockExecutionScope, transactionAborted, withExecutionOwnership, withExecutionSignal, currentExecutionOwnership, EXECUTION_LEASE_MS, ExecutionOwnershipLost } from '../execution-ownership'
import { recordProgress } from './events'
import { taskPlanSchema, taskInputSchema, taskJobSchema, taskArtifactSchema, taskIsSettled, validateTaskGraph,
  retryDecision, TaskFailure, ANALYSIS_RECOVERY_MS, MAX_TASKS_PER_AUDIT, COMPLETION_TASK_KINDS, SETTLED_TASK_STATES, runsAfterCompletion,
  type TaskPlan, type TaskKind, type TaskArtifact } from './contracts'
import { taskAuditSelect, type TaskHandler, type TaskContext, type TaskDependency } from './registry'
import { getBrowserDiagnostics } from '../screenshot'
import { readWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { StorageUploadError, StorageNotConfiguredError } from '../pipeline-errors'
import { isObservedPageCaptureFailure, PageCaptureError } from '../browser/page-capture'
import { claimTaskDelivery, retireObsoleteTaskDeliveries } from './delivery-window'
import { claimProgressiveRecovery, selectProgressiveRecovery } from './recovery-claim'
import { isBrowserEvidenceKey } from './collection-requirements'
import { classifyJudgeProviderFailure, isRetryableJudgeError, JudgeProviderError } from '../judge'

/** A cooperative deadline also has an enforced boundary. Late continuations
 * lose write authority, while the engine retains authority to record failure. */
async function withinTaskDeadline(context: TaskContext, work: (check: () => void) => Promise<void>) {
  const controller = new AbortController()
  return withExecutionSignal(controller.signal, async () => {
    const signal = currentExecutionOwnership()?.signal ?? controller.signal
    context.signal = signal
    const failure = () => new TaskFailure('TASK_DEADLINE_EXCEEDED', true, undefined, true)
    const check = () => {
      if (signal.aborted) throw signal.reason instanceof TaskFailure ? signal.reason : new ExecutionOwnershipLost()
      if (Date.now() >= context.deadline) {
        const error = failure()
        controller.abort(error)
        throw error
      }
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    let interrupted!: () => void
    try {
      const remaining = context.deadline - Date.now()
      if (remaining <= 0) throw failure()
      const cancelled = new Promise<never>((_resolve, reject) => {
        interrupted = () => reject(signal.reason instanceof TaskFailure ? signal.reason : new ExecutionOwnershipLost())
        if (signal.aborted) interrupted()
        else signal.addEventListener('abort', interrupted, { once: true })
      })
      timer = setTimeout(() => controller.abort(failure()), remaining)
      check()
      await Promise.race([work(check), cancelled])
    } finally {
      clearTimeout(timer)
      if (interrupted) signal.removeEventListener('abort', interrupted)
      controller.abort(new ExecutionOwnershipLost())
    }
  })
}

export async function persistTaskPlan(auditId: string, plans: TaskPlan[]) {
  validateTaskGraph(plans)
  const admitted = plans.map(plan => taskPlanSchema.parse(plan))
  return executionTransaction(async tx => {
    const parent = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "audits" WHERE "id" = ${auditId} FOR UPDATE`
    if (!parent.length) throw new Error('Execution not found')
    const existing = await tx.auditExecutionTask.findMany({ where: { auditId },
      select: { id: true, targetKey: true, scopeKey: true, workKind: true, workInput: true, workDependencies: true, workState: true },
      take: MAX_TASKS_PER_AUDIT + 1 })
    const existingByKey = new Map(existing.map(task => [task.targetKey.slice(5), task]))
    if (existingByKey.size !== existing.length) throw new Error('Duplicate task identity')
    const effective = new Map(existing.map(task => [task.targetKey.slice(5), taskPlanSchema.parse({ key: task.targetKey.slice(5),
      kind: task.workKind, scope: task.scopeKey, input: task.workInput, dependencies: task.workDependencies })]))
    const additions: TaskPlan[] = [], updates: Array<{ id: string; dependencies: string[] }> = []
    for (const plan of admitted) {
      const recorded = effective.get(plan.key)
      if (!recorded) { additions.push(plan); effective.set(plan.key, plan); continue }
      if (recorded.scope !== plan.scope || recorded.kind !== plan.kind) throw new Error('Execution task identity changed')
      const task = existingByKey.get(plan.key)!
      if (task.workState !== 'WAITING' || !['finalize', 'cross-page'].includes(plan.kind)) continue
      // Discovery retries can carry an older graph. Never remove obligations
      // committed by another expansion while updating a waiting summary.
      const dependencies = [...new Set([...recorded.dependencies, ...plan.dependencies])]
      if (dependencies.length !== recorded.dependencies.length) {
        effective.set(plan.key, { ...recorded, dependencies })
        updates.push({ id: task.id, dependencies })
      }
    }
    validateTaskGraph([...effective.values()])
    // Both profiles share one private salt, retaining distinct redacted errors
    // without counting the same page-load exception twice. Persist it once.
    const consoleKeys = new Map<string, string>()
    for (const task of existing) {
      const input = task.workInput as { pageUrl?: string; consoleIdentityKey?: string } | null
      if (task.workKind === 'browser' && input?.pageUrl && input.consoleIdentityKey) consoleKeys.set(input.pageUrl, input.consoleIdentityKey)
    }
    for (const plan of additions) if (plan.kind === 'browser' && plan.input.device) {
      const key = consoleKeys.get(plan.input.pageUrl) ?? randomUUID()
      consoleKeys.set(plan.input.pageUrl, key)
      plan.input = { ...plan.input, consoleIdentityKey: key }
    }
    if (additions.length) await tx.auditExecutionTask.createMany({ data: additions.map(plan => ({
      auditId, targetKey: 'task:' + plan.key, scopeKey: plan.scope, pageUrl: plan.input.pageUrl, source: 'EXECUTION', status: 'PENDING',
      workKind: plan.kind, workInput: plan.input, workDependencies: plan.dependencies,
      workState: plan.dependencies.length ? 'WAITING' : 'READY', workRetryAt: new Date(), workDispatchState: 'PENDING',
    })), skipDuplicates: true })
    for (const update of updates) await tx.auditExecutionTask.updateMany({
      where: { id: update.id, workState: 'WAITING' }, data: { workDependencies: update.dependencies },
    })
    await recordProgress(tx, auditId, { kind: 'plan', state: 'admitted' })
  })
}
export async function loadTasks(auditId: string) {
  const tasks = await prisma.auditExecutionTask.findMany({
    where: { auditId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_TASKS_PER_AUDIT + 1,
  })
  if (tasks.length > MAX_TASKS_PER_AUDIT) throw new Error('Execution task limit exceeded')
  return tasks
}

export async function loadTaskGraph(auditId: string) {
  const tasks = await prisma.auditExecutionTask.findMany({ where: { auditId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_TASKS_PER_AUDIT + 1,
    omit: { workResult: true, detail: true, evidenceReference: true } })
  if (tasks.length > MAX_TASKS_PER_AUDIT) throw new Error('Execution task limit exceeded')
  return tasks
}

/** Queue failure can follow a committed continuation. Recovery belongs to the
 * unclaimed delivery, independently of a worker's later broker acknowledgement. */
export async function recoverInterruptedTaskDelivery(job: { id?: string; data: unknown } | undefined) {
  const parsed = taskJobSchema.safeParse(job?.data)
  if (!parsed.success || job?.id !== parsed.data.taskId + '-g' + parsed.data.generation) return false
  const { taskId, auditId, generation } = parsed.data
  const changed = await prisma.auditExecutionTask.updateMany({
    where: { id: taskId, auditId, workGeneration: generation - 1, workState: 'READY', workDispatchState: 'SENT',
      audit: { status: { not: 'FAILED' } },
      OR: [{ audit: { status: { not: 'COMPLETED' } } }, { workKind: { in: [...COMPLETION_TASK_KINDS] } }] },
    data: { workDispatchState: 'PENDING', workRetryAt: new Date(Date.now() + 1000) },
  })
  return changed.count === 1
}

export async function dispatchTask(taskId: string, canPublish?: () => boolean): Promise<boolean> {
  if (canPublish?.() === false) return false
  const delivery = await claimTaskDelivery(taskId)
  if (!delivery) return false
  const { task, input, resource, lease } = delivery
  const dispatchOwner = { id: taskId, workState: 'READY' as const, workGeneration: task.workGeneration, workDispatchLeaseUntil: lease }
  try {
    if (resource === 'browser' && !getBrowserDiagnostics().connected && !(await readWorkerHeartbeat().catch(() => null))?.browserOk) {
      await executionTransaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "audits" WHERE "id" = ${task.auditId} FOR UPDATE`
        const updated = await tx.auditExecutionTask.updateMany({ where: dispatchOwner,
          data: { workState: 'RETRY_WAIT', workDispatchLeaseUntil: null, workDispatchState: 'PENDING',
            workRetryAt: new Date(Date.now() + 20_000), workErrorCode: 'BROWSER_UNHEALTHY',
            workRecoveryUntil: task.workRecoveryUntil ?? new Date(Date.now() + 30 * 60_000) } })
        if (updated.count) await recordProgress(tx, task.auditId, { taskId, kind: task.workKind!, state: 'RETRY_WAIT' })
      })
      return false
    }
    if (canPublish?.() === false) {
      // No broker call occurred. Release this reservation without replacing
      // the last known delivery state or manufacturing a failed attempt.
      await prisma.auditExecutionTask.updateMany({ where: dispatchOwner,
        data: { workDispatchState: task.workDispatchState, workDispatchLeaseUntil: null } })
      return false
    }
    const queue = getAuditTaskQueue(resource)
    const priority = priorityForTask(task.workKind as TaskKind, input, task.workAttempts,
      task.workGeneration > task.workAttempts, Date.now() - task.createdAt.getTime())
    const jobId = taskId + '-g' + (task.workGeneration + 1)
    const existingJob = await queue.getJob(jobId)
    const existingState = existingJob ? await existingJob.getState() : null
    const queuedPriority = existingJob && Date.now() - existingJob.timestamp >= 2 * DELIVERY_RECHECK_MS ? 1 : priority
    if (existingJob && (existingState === 'failed' || existingState === 'completed')) await existingJob.retry(existingState)
    else if (!existingJob) await queue.add('audit-task', { auditId: task.auditId, taskId, generation: task.workGeneration + 1 },
      { jobId, attempts: 1, removeOnComplete: 100, removeOnFail: 500,
        priority })
    else if (['waiting', 'prioritized', 'paused'].includes(existingState ?? '') && existingJob.priority > queuedPriority) {
      // Reconcile retained deliveries to current admission policy. Promotion
      // never resets an older observation's place within its priority.
      await existingJob.changePriority({ priority: queuedPriority })
    }
    // A delivered job can wait in a busy queue without occupying every recovery
    // batch. Recheck later so a lost Redis delivery still gets reconstructed.
    await prisma.auditExecutionTask.updateMany({ where: dispatchOwner,
      data: { workDispatchState: 'SENT', workDispatchLeaseUntil: null, workRetryAt: new Date(Date.now() + DELIVERY_RECHECK_MS) } })
    return true
  } catch {
    await prisma.auditExecutionTask.updateMany({ where: dispatchOwner,
      data: { workDispatchState: 'FAILED', workDispatchLeaseUntil: null, workRetryAt: new Date(Date.now() + 5000),
        workErrorCode: 'QUEUE_UNAVAILABLE' } })
    return false
  }
}

type ReconciliationTask = Pick<AuditExecutionTask, 'id' | 'auditId' | 'targetKey' | 'createdAt' | 'workKind' | 'workState' |
  'workInput' | 'workDependencies' | 'workGeneration' | 'workAttempts' | 'workToken' | 'workRecoveryUntil' |
  'workLeaseUntil' | 'workRetryAt' | 'workDispatchLeaseUntil'>

/** Settled tasks still satisfy dependencies and contribute progress. Their
 * retained execution inputs are only needed when reading the admitted plan. */
async function loadReconciliationGraph(auditId: string) {
  const tasks = await prisma.$queryRaw<ReconciliationTask[]>`
    SELECT id, "auditId", "targetKey", "createdAt", "workKind", "workState", "workGeneration", "workAttempts",
      "workToken", "workRecoveryUntil", "workLeaseUntil", "workRetryAt", "workDispatchLeaseUntil",
      CASE WHEN "workState"::text IN (${Prisma.join([...SETTLED_TASK_STATES])}) THEN NULL ELSE "workInput" END AS "workInput",
      CASE WHEN "workState" = 'WAITING' THEN "workDependencies" ELSE ARRAY[]::text[] END AS "workDependencies"
    FROM audit_execution_tasks WHERE "auditId" = ${auditId}
    ORDER BY "createdAt", id LIMIT ${MAX_TASKS_PER_AUDIT + 1}`
  if (tasks.length > MAX_TASKS_PER_AUDIT) throw new Error('Execution task limit exceeded')
  return tasks
}

const TASKS_PER_EXPIRY_SETTLEMENT = 16

export async function reconcileTasks(auditId: string) {
  const audit = await prisma.audit.findUnique({ where: { id: auditId }, select: { createdAt: true, status: true, recoveryUntil: true } })
  if (!audit || audit.status === 'FAILED') return []
  const until = analysisRecoveryEndsAt(audit)
  const tasks = await loadReconciliationGraph(auditId), byKey = new Map(tasks.map(task => [task.targetKey.slice(5), task]))
  const ready = new Set<string>()
  const expiredAt = new Date()
  const expired = tasks.filter(task => {
    if (taskIsSettled(task.workState) || task.workKind === 'finalize' ||
      audit.status === 'COMPLETED' && !runsAfterCompletion(task.workKind)) return false
    const taskUntil = task.workKind === 'prescription' ? task.createdAt.getTime() + ANALYSIS_RECOVERY_MS : until
    return expiredAt.getTime() >= taskUntil || Boolean(task.workRecoveryUntil && expiredAt >= task.workRecoveryUntil)
  })
  const expiredIds = new Set(expired.map(task => task.id))
  let prescriptionSettled = false
  // Bound lock duration and settle each cohort once. Concurrent completion
  // callbacks must not open a transaction for every already-expired task.
  for (let offset = 0; offset < expired.length; offset += TASKS_PER_EXPIRY_SETTLEMENT) {
    const cohort = expired.slice(offset, offset + TASKS_PER_EXPIRY_SETTLEMENT)
    const settled = await executionTransaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "audits" WHERE "id" = ${auditId} FOR UPDATE`
      const updated = await tx.auditExecutionTask.updateManyAndReturn({
        where: { auditId, workState: { notIn: [...SETTLED_TASK_STATES] }, OR: cohort.map(task => ({
          id: task.id, workGeneration: task.workGeneration, workRecoveryUntil: task.workRecoveryUntil,
        })) },
        data: { workState: 'EXHAUSTED', status: 'FAILED', workToken: null, workLeaseUntil: null, workErrorCode: 'RECOVERY_EXHAUSTED' },
        select: { id: true },
      })
      const ids = new Set(updated.map(task => task.id))
      for (const task of cohort) if (ids.has(task.id)) {
        await publishUnfinishedCoverage(tx, task, 'RECOVERY_EXHAUSTED')
        await recordProgress(tx, auditId, { taskId: task.id, kind: task.workKind!, state: 'EXHAUSTED' })
      }
      return ids
    })
    for (const task of cohort) if (settled.has(task.id)) {
      task.workState = 'EXHAUSTED'
      prescriptionSettled ||= task.workKind === 'prescription'
    }
  }
  if (prescriptionSettled) await recordSettledPrescriptionCost(auditId).catch(error => logUnrecordedPrescriptionCost(auditId, error))
  for (const task of tasks) {
    const now = new Date()
    const admittedAt = task.workKind === 'prescription' ? task.createdAt.getTime() : audit.createdAt.getTime()
    if (taskIsSettled(task.workState) || expiredIds.has(task.id)) continue
    if (audit.status === 'COMPLETED' && !runsAfterCompletion(task.workKind)) continue
    if (task.workState === 'RUNNING' && task.workLeaseUntil && task.workLeaseUntil <= now) {
      const decision = retryDecision({ now: now.getTime(), admittedAt,
        firstFailureAt: task.workRecoveryUntil ? task.workRecoveryUntil.getTime() - 30 * 60_000 : undefined,
        attempts: task.workAttempts, crash: true, retryable: true })
      const recoveryUntil = new Date(decision.until), retryAt = new Date(decision.nextAt)
      const settled = await executionTransaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "audits" WHERE "id" = ${auditId} FOR UPDATE`
        const updated = await tx.auditExecutionTask.updateMany({
          where: { id: task.id, workToken: task.workToken, workGeneration: task.workGeneration, workState: 'RUNNING', workLeaseUntil: { lte: now } },
          data: { workState: decision.retry ? 'RETRY_WAIT' : 'EXHAUSTED', status: 'FAILED', workToken: null,
            workLeaseUntil: null, workRecoveryUntil: recoveryUntil, workRetryAt: retryAt,
            workErrorCode: 'WORKER_INTERRUPTED', workDispatchState: 'PENDING' },
        })
        if (updated.count) {
          if (!decision.retry) {
            await publishUnfinishedCoverage(tx, task, 'WORKER_INTERRUPTED')
            await settleFailedFinalization(tx, task)
          }
          await recordProgress(tx, auditId, { taskId: task.id, kind: task.workKind!, state: decision.retry ? 'RETRY_WAIT' : 'EXHAUSTED' })
        }
        return updated.count
      })
      if (settled) {
        task.workState = decision.retry ? 'RETRY_WAIT' : 'EXHAUSTED'
        task.workRecoveryUntil = recoveryUntil
        task.workRetryAt = retryAt
        if (!decision.retry && task.workKind === 'prescription') await recordSettledPrescriptionCost(auditId).catch(error => logUnrecordedPrescriptionCost(auditId, error))
      }
      continue
    }
  }
  // Settle every expired obligation before evaluating readiness. A dependent
  // may precede its inputs in persisted order after discovery expands a graph.
  const now = new Date()
  const releases: Prisma.AuditExecutionTaskWhereInput[] = []
  for (const task of tasks) {
    if (taskIsSettled(task.workState)) continue
    if (audit.status === 'COMPLETED' && !runsAfterCompletion(task.workKind)) continue
    const fence = { id: task.id, workGeneration: task.workGeneration, workRecoveryUntil: task.workRecoveryUntil }
    if (task.workState === 'WAITING' && task.workDependencies.every(key => taskIsSettled(byKey.get(key)?.workState ?? null))) {
      releases.push({ ...fence, workState: 'WAITING', workDependencies: { equals: task.workDependencies } })
    } else if (task.workState === 'RETRY_WAIT' && task.workRetryAt && task.workRetryAt <= now) {
      releases.push({ ...fence, workState: 'RETRY_WAIT', workRetryAt: task.workRetryAt })
    } else if (task.workState === 'READY' && (!task.workRetryAt || task.workRetryAt <= now) &&
      (!task.workDispatchLeaseUntil || task.workDispatchLeaseUntil <= now)) ready.add(task.id)
  }
  if (releases.length) {
    // Use the graph writer's lock order and compare the saved dependencies and
    // retry time. Discovery or recovery can change either after the graph read.
    const released = await executionTransaction(async tx => {
      if (!await lockExecutionScope(tx, auditId)) return []
      return tx.auditExecutionTask.updateManyAndReturn({
        where: { auditId, audit: { status: { not: 'FAILED' } }, AND: [
          { OR: releases },
          { OR: [{ audit: { status: { not: 'COMPLETED' } } }, { workKind: { in: [...COMPLETION_TASK_KINDS] } }] },
        ] },
        data: { workState: 'READY', status: 'PENDING', workRetryAt: now, workDispatchState: 'PENDING' },
        select: { id: true },
      })
    })
    for (const { id } of released) ready.add(id)
  }
  if (tasks.some(task => ['check', 'search'].includes(task.workKind ?? '') && task.workState === 'COMPLETED'))
    await prisma.audit.updateMany({ where: { id: auditId, status: { in: ['QUEUED', 'CAPTURING'] } }, data: { status: 'CHECKING' } })
  // Old, due deliveries rotate behind undispatched work after each queue check.
  // Graph insertion order must not let a blocked resource starve other queues.
  const dueAt = new Map(tasks.map(task => [task.id, task.workRetryAt?.getTime() ?? 0]))
  const ordered = tasks.filter(task => ready.has(task.id)).map(task => task.id)
    .sort((left, right) => dueAt.get(left)! - dueAt.get(right)!)
  // Reorder within resource slots, preserving other resources' opportunities
  // when either browser or PageSpeed dispatch is unavailable.
  const replacements = new Map<string, string>()
  for (const resource of ['browser', 'pagespeed'] as const) {
    const members = tasks.filter(task => ready.has(task.id)).flatMap(task => {
      const input = taskInputSchema.safeParse(task.workInput)
      return input.success && queueForTask(task.workKind as TaskKind, input.data) === resource
        ? [{ id: task.id, priority: priorityForTask(task.workKind as TaskKind, input.data, task.workAttempts,
          task.workGeneration > task.workAttempts, Date.now() - task.createdAt.getTime()) }] : []
    })
    const ids = new Set(members.map(task => task.id))
    members.sort((left, right) => left.priority - right.priority || dueAt.get(left.id)! - dueAt.get(right.id)!)
    let index = 0
    for (const id of ordered) if (ids.has(id)) replacements.set(id, members[index++].id)
  }
  return ordered.map(id => replacements.get(id) ?? id)
}

async function commitTaskObservation(context: TaskContext, handler: TaskHandler, artifact: TaskArtifact,
  tx: Prisma.TransactionClient, partial: boolean, check: () => void = () => {}) {
  let result = artifact
  const committed = await handler.commit?.(context, result, tx)
  if (committed) {
    if (committed.kind !== result.kind || committed.continuation !== result.continuation)
      throw new TaskFailure('OBSERVATION_CHECKPOINT_INVALID', false)
    result = taskArtifactSchema.parse(scopeTaskArtifact(committed, context.audit.executionSpec))
    handler.validateResult(result)
  }
  check()
  await tx.auditPipelineEvent.create({ data: {
    auditId: context.audit.id, executionId: context.task.id, traceId: context.audit.id, attempt: context.task.workAttempts,
    stage: 'checking', event: 'task_observation_committed', status: partial ? 'partial' : 'completed',
    detail: { version: 1, taskId: context.task.id, generation: context.task.workGeneration, kind: handler.kind,
      collectedAt: result.collectedAt, evidenceReference: context.task.id,
      ...(handler.kind === 'check' || handler.kind === 'search' || handler.kind === 'google' ? { observations: result.data } : {}) },
  } })
  return result
}

const completionPasses = new Map<string, { started: boolean; result: Promise<string[]> }>()

/** A settlement after a pass starts needs a fresh read. Other settlements
 * can join that pending pass. Only its first caller takes the dispatch cohort. */
function reconcileAfterTask(auditId: string): Promise<string[]> {
  const previous = completionPasses.get(auditId)
  if (previous && !previous.started) return previous.result.then(() => [])

  const pass = { started: false, result: previous ? previous.result.then(run, run) : Promise.resolve().then(run) }
  completionPasses.set(auditId, pass)
  return pass.result

  async function run(): Promise<string[]> {
    pass.started = true
    try { return await reconcileTasks(auditId) }
    finally {
      // Publication may still be waiting on Redis. Later database passes can
      // release independent work without waiting for that publication.
      if (completionPasses.get(auditId) === pass) completionPasses.delete(auditId)
    }
  }
}

export async function continueTaskGraph(auditId: string) {
  await dispatchReadyTasks(await reconcileAfterTask(auditId))
}

export async function executeTask(rawJob: unknown, handlers: Map<string, TaskHandler>,
  continueExecution: (auditId: string) => void | Promise<void> = continueTaskGraph) {
  const job = taskJobSchema.parse(rawJob)
  const original = await prisma.auditExecutionTask.findFirst({
    where: { id: job.taskId, auditId: job.auditId }, include: { audit: { select: taskAuditSelect } },
    // Claim admission needs metadata, not a second copy of the prior artifact.
    omit: { workResult: true, detail: true, evidenceReference: true },
  })
  if (!original || !original.workKind || original.audit.status === 'FAILED' ||
    original.audit.status === 'COMPLETED' && !runsAfterCompletion(original.workKind)) return
  const handler = handlers.get(original.workKind)
  if (!handler) throw new Error('Unregistered execution task')
  const token = randomUUID()
  const input = taskInputSchema.parse(original.workInput)
  const claimed = await executionTransaction(async tx => {
    if (!await lockExecutionScope(tx, job.auditId)) return { count: 0 }
    await tx.$queryRaw`SELECT "id" FROM "audit_execution_tasks" WHERE "id" = ${original.id} FOR UPDATE`
    const now = new Date()
    if (original.workKind === 'finalize' || original.workKind === 'prescription') {
      const audit = await tx.audit.findUniqueOrThrow({ where: { id: job.auditId },
        select: { executionLeaseUntil: true, status: true, triageAt: true, completedAt: true } })
      const canOverlapCoordinator = original.workKind === 'finalize' && audit.status !== 'COMPLETED'
      if (!canOverlapCoordinator && audit.executionLeaseUntil && audit.executionLeaseUntil > now) {
        await tx.auditExecutionTask.updateMany({ where: { id: original.id, workState: 'READY', workGeneration: job.generation - 1 },
          data: { workState: 'RETRY_WAIT', workRetryAt: new Date(Math.min(audit.executionLeaseUntil.getTime(), now.getTime() + 5000)),
            workErrorCode: 'EXECUTION_BUSY', workDispatchState: 'PENDING', workDispatchLeaseUntil: null } })
        return { count: 0 }
      }
      // Restore legacy prescription's recorded terminal state only after the
      // original writer's lease expires. Its expired token remains fenced.
      if (original.workKind === 'prescription' && audit.status === 'JUDGING' && audit.triageAt && audit.completedAt)
        await tx.audit.update({ where: { id: job.auditId }, data: { status: 'COMPLETED', progress: 100 } })
    }
    if (input.fixtureId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'fixture:' + input.fixtureId}))`
      const activeFixture = await tx.auditExecutionTask.findFirst({ where: { id: { not: original.id },
        workState: 'RUNNING', workLeaseUntil: { gt: now }, workInput: { path: ['fixtureId'], equals: input.fixtureId } }, select: { id: true } })
      if (activeFixture) {
        await tx.auditExecutionTask.updateMany({ where: { id: original.id, workState: 'READY', workGeneration: job.generation - 1 },
          data: { workState: 'RETRY_WAIT', workRetryAt: new Date(Date.now() + 5000), workErrorCode: 'FIXTURE_BUSY', workDispatchState: 'PENDING', workDispatchLeaseUntil: null } })
        await recordProgress(tx, job.auditId, { taskId: original.id, kind: original.workKind!, state: 'RETRY_WAIT' })
        return { count: 0 }
      }
    }
    return tx.auditExecutionTask.updateMany({
    where: { id: original.id, auditId: job.auditId, workState: 'READY', workGeneration: job.generation - 1,
      audit: { status: { not: 'FAILED' } },
      OR: [{ audit: { status: { not: 'COMPLETED' } } }, { workKind: { in: [...COMPLETION_TASK_KINDS] } }] },
    data: { workState: 'RUNNING', status: 'RUNNING', workToken: token, workGeneration: { increment: 1 },
      workAttempts: { increment: 1 }, workLeaseUntil: new Date(now.getTime() + EXECUTION_LEASE_MS), workDispatchLeaseUntil: null },
    })
  })
  if (claimed.count !== 1) return
  const task = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: original.id } })
  const owner = { auditId: job.auditId, taskId: task.id, token, generation: job.generation }
  await withExecutionOwnership(owner, async () => {
    let failedContext: TaskContext | undefined
    try {
    await executionTransaction(async tx => {
      if (handler.kind === 'judge') await tx.audit.updateMany({ where: { id: job.auditId,
        status: { in: ['QUEUED', 'CAPTURING', 'CHECKING'] } }, data: { status: 'JUDGING' } })
      if (handler.kind === 'finalize') await tx.audit.updateMany({ where: { id: job.auditId,
        status: { notIn: ['COMPLETED', 'FAILED'] } }, data: { status: 'FINALIZING' } })
      await recordProgress(tx, job.auditId, { taskId: task.id, kind: handler.kind, state: 'RUNNING' })
    })
      const requiredKeys = ['finalize', 'discovery', 'cross-page', 'bindings'].includes(handler.kind) ? []
        : handler.kind === 'judge' ? task.workDependencies.filter(key => isBrowserEvidenceKey(key) || key.endsWith(':captures')) : task.workDependencies
      // Dependencies supply immutable observations, not the task's mutable
      // delivery state or legacy detail. Only Search reads retained markup.
      // Leave malformed shapes intact for the existing artifact validation.
      const tasks = requiredKeys.length ? await prisma.$queryRaw<TaskDependency[]>`
        SELECT "id", "auditId", "targetKey", "workKind", "workState", "workInput",
          CASE WHEN ${handler.kind !== 'search'} AND "workKind" IN ('browser', 'captures')
            AND jsonb_typeof("workResult"->'data'->'snapshot'->'desktopHtml') = 'string'
            THEN jsonb_set("workResult", '{data,snapshot,desktopHtml}', 'null'::jsonb, false)
            ELSE "workResult" END AS "workResult"
        FROM audit_execution_tasks WHERE "auditId" = ${job.auditId}
          AND "targetKey" IN (${Prisma.join(requiredKeys.map(key => 'task:' + key))}) LIMIT ${requiredKeys.length}` : []
      const byKey = new Map(tasks.map(item => [item.targetKey.slice(5), item]))
      const input = taskInputSchema.parse(task.workInput)
      const timeoutMs = typeof handler.timeoutMs === 'function' ? handler.timeoutMs(original.audit, input) : handler.timeoutMs
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TaskFailure('TASK_BUDGET_INVALID', false)
      const context: TaskContext = { audit: original.audit, task, input,
        deadline: Math.min(Date.now() + timeoutMs, analysisRecoveryEndsAt(original.audit)),
        dependencies: new Map(task.workDependencies.flatMap(key => byKey.has(key) ? [[key, byKey.get(key)!] as const] : [])) }
      failedContext = context
      if (runsAfterCompletion(handler.kind)) context.deadline = Math.min(Date.now() + timeoutMs,
        handler.kind === 'prescription' ? Math.min(task.createdAt.getTime() + ANALYSIS_RECOVERY_MS, task.workRecoveryUntil?.getTime() ?? Infinity) : Infinity)
      await withinTaskDeadline(context, async check => {
        if (handler.replay === 'protected' && task.workAttempts > 1 && !await handler.reconcile!(context))
          throw new TaskFailure('PROTECTED_EFFECT_UNRESOLVED', false)
        check()
        let result = taskArtifactSchema.parse(scopeTaskArtifact(await handler.evaluate(context), original.audit.executionSpec))
        handler.validateResult(result)
        if (result.continuation && (!handler.continuation || handler.replay !== 'read_only')) throw new TaskFailure('CONTINUATION_NOT_SUPPORTED', false)
        check()
        await executionTransaction(async tx => {
          result = await commitTaskObservation(context, handler, result, tx, Boolean(result.continuation), check)
          await tx.auditExecutionTask.update({ where: { id: task.id }, data: {
            workResult: result as Prisma.InputJsonValue, workState: result.continuation ? 'READY' : 'COMPLETED', status: result.continuation ? 'PENDING' : 'COMPLETED',
            workErrorCode: null, workLeaseUntil: null,
            ...(result.continuation ? { workToken: null, workAttempts: 0, workRecoveryUntil: null, workRetryAt: new Date(),
              workDispatchState: 'PENDING', workDispatchLeaseUntil: null } : {}),
          } })
          if (handler.kind === 'prescription') await settlePrescriptionAudit(tx, job.auditId)
          await recordProgress(tx, job.auditId, { taskId: task.id, kind: handler.kind, state: result.continuation ? 'READY' : 'COMPLETED', observationReference: task.id })
          check()
        })
      })
    } catch (error) {
      if (error instanceof ExecutionOwnershipLost) return
      let failure = classifyTaskFailure(error, handler.kind), observation: TaskArtifact | undefined
      if (failure.observation) {
        try {
          observation = taskArtifactSchema.parse(scopeTaskArtifact(failure.observation, original.audit.executionSpec))
          if (!failedContext || handler.replay !== 'read_only' || observation.kind !== handler.kind || observation.continuation)
            throw new TaskFailure('OBSERVATION_CHECKPOINT_INVALID', false)
          handler.validateResult(observation)
        } catch {
          observation = undefined
          failure = new TaskFailure('OBSERVATION_CHECKPOINT_INVALID', false)
        }
      }
      const decision = retryDecision({ now: Date.now(), admittedAt: task.workKind === 'prescription' ? task.createdAt.getTime() : original.audit.createdAt.getTime(),
        firstFailureAt: task.workRecoveryUntil ? task.workRecoveryUntil.getTime() - 30 * 60_000 : undefined,
        attempts: task.workAttempts, crash: failure.crash, retryable: failure.retryable, retryAfterMs: failure.retryAfterMs })
      try {
        await executionTransaction(async tx => {
          // Keep independently collected facts without resetting retry custody.
          // A later failure with no observation leaves the committed facts intact.
          if (observation && failedContext) observation = await commitTaskObservation(failedContext, handler, observation, tx, true)
          if (error instanceof PageCaptureError && !failure.retryable) await tx.auditPipelineEvent.create({ data: {
            auditId: job.auditId, executionId: task.id, traceId: job.auditId, attempt: task.workAttempts,
            stage: 'checking', event: 'page_response_unavailable', status: 'partial',
            detail: { version: 1, taskId: task.id, generation: job.generation, kind: handler.kind,
              code: error.code, httpStatus: error.httpStatus, contentType: error.contentType, finalUrl: error.finalUrl },
          } })
          await tx.auditExecutionTask.update({ where: { id: task.id }, data: {
            ...(observation ? { workResult: observation as Prisma.InputJsonValue } : {}),
            workState: decision.retry ? 'RETRY_WAIT' : failure.retryable ? 'EXHAUSTED' : 'BLOCKED',
            status: failure.code.endsWith('_NOT_APPLICABLE') ? 'NOT_APPLICABLE' : 'FAILED',
            workRetryAt: new Date(decision.nextAt), workRecoveryUntil: new Date(decision.until), workLeaseUntil: null,
            workErrorCode: failure.code, workDispatchState: 'PENDING',
          } })
          if (!decision.retry && !failure.code.endsWith('_NOT_APPLICABLE')) await publishUnfinishedCoverage(tx, task, failure.code)
          if (!decision.retry) await settleFailedFinalization(tx, task)
          await recordProgress(tx, job.auditId, { taskId: task.id, kind: handler.kind,
            state: decision.retry ? 'RETRY_WAIT' : failure.retryable ? 'EXHAUSTED' : 'BLOCKED' })
        })
      } catch (writeError) {
        if (!(writeError instanceof ExecutionOwnershipLost)) throw writeError
      }
    }
  })
  if (original.workKind === 'prescription') await recordSettledPrescriptionCost(job.auditId).catch(error => logUnrecordedPrescriptionCost(job.auditId, error))
  await continueExecution(job.auditId)
}

export function classifyTaskFailure(error: unknown, kind?: TaskKind): TaskFailure {
  if (error instanceof ScanAccessUnavailable) return new TaskFailure(error.code, false)
  if (error instanceof TaskFailure) return error
  if (kind === 'judge' || kind === 'prescription') {
    const providerFailure = classifyJudgeProviderFailure(error)
    if (providerFailure || error instanceof JudgeProviderError) {
      const retryable = isRetryableJudgeError(error)
      const code = providerFailure === 'budget_unavailable' ? 'AI_BUDGET_UNAVAILABLE'
        : !retryable && providerFailure === 'quota_exhausted' ? 'AI_PROVIDER_QUOTA_EXHAUSTED'
        : !retryable && providerFailure === 'authentication_rejected' ? 'AI_PROVIDER_AUTH_REJECTED'
          : !retryable && providerFailure === 'permission_denied' ? 'AI_PROVIDER_PERMISSION_DENIED' : 'AI_PROVIDER_UNAVAILABLE'
      return new TaskFailure(code, retryable)
    }
  }
  // A refused navigation is a completed observation of unavailable scope. A
  // fresh scheduled run can observe recovery; repeating secondary browser work
  // inside this run cannot replace its already recorded page capture evidence.
  if (error instanceof PageCaptureError && isObservedPageCaptureFailure(error.code))
    return new TaskFailure('PAGE_' + error.code.toUpperCase(), false)
  if (error instanceof StorageNotConfiguredError) return new TaskFailure('STORAGE_NOT_CONFIGURED', false)
  if (error instanceof StorageUploadError) return new TaskFailure('STORAGE_UPLOAD_INTERRUPTED', true)
  if (error instanceof Prisma.PrismaClientInitializationError || error instanceof Prisma.PrismaClientKnownRequestError &&
    ['P1001', 'P1002', 'P1017', 'P2024', 'P2028', 'P2034'].includes(error.code) || transactionAborted(error))
    return new TaskFailure('PERSISTENCE_UNAVAILABLE', true)
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null
  if (typeof code === 'string' && ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH'].includes(code))
    return new TaskFailure('DEPENDENCY_INTERRUPTED', true)
  return new TaskFailure('TASK_INTERRUPTED', true, undefined, true)
}

const TASKS_PER_GRAPH_DISPATCH = 8
const TASK_DISPATCH_CONCURRENCY = 4

async function dispatchTaskCohort(ids: string[], canPublish?: () => boolean) {
  const pending = ids.values()
  const lanes = Math.min(ids.length, TASK_DISPATCH_CONCURRENCY)
  const counts = await Promise.all(Array.from({ length: lanes }, async () => {
    let sent = 0
    for (const taskId of pending) {
      if (canPublish?.() === false) break
      try { if (await dispatchTask(taskId, canPublish)) sent++ }
      catch (error) { logger.error('Task dispatch interrupted; retained ledger will be retried', error, { taskId }) }
    }
    return sent
  }))
  return counts.reduce((total, sent) => total + sent, 0)
}

/** Keep normal admission and continuation dispatch bounded per graph. */
export function dispatchReadyTasks(ids: string[], canPublish?: () => boolean) {
  return dispatchTaskCohort(ids.slice(0, TASKS_PER_GRAPH_DISPATCH), canPublish)
}

export async function recoverActiveTaskGraphs(limit = 25, canPublish?: () => boolean) {
  const dueAt = new Date()
  const audits = await selectProgressiveRecovery('graph', dueAt, limit)
  const deadline = Date.now() + 10_000
  const ready: string[][] = []
  for (const { id: auditId } of audits) {
    if (Date.now() >= deadline) break
    try {
      if (!await claimProgressiveRecovery('graph', dueAt, auditId)) continue
      const ids = await reconcileTasks(auditId)
      if (ids.length) ready.push(ids.slice(0, TASKS_PER_GRAPH_DISPATCH))
    }
    catch (error) { logger.error('Audit task recovery interrupted; retained graph will be retried', error, { auditId }) }
  }
  // First settle the admitted graphs in PostgreSQL. Broker delays must not
  // prevent another graph in the same cohort from recording interrupted work.
  // Give each graph a turn before publishing another task from the same graph.
  const deliveries: string[] = []
  for (let position = 0; position < TASKS_PER_GRAPH_DISPATCH; position++) {
    for (const ids of ready) if (position < ids.length) deliveries.push(ids[position])
  }
  const deliveryDeadline = Date.now() + 10_000
  return dispatchTaskCohort(deliveries, () => Date.now() < deliveryDeadline && canPublish?.() !== false)
}

export async function recoverProgressiveTasks(limit = 25) {
  const retirement = retireObsoleteTaskDeliveries(limit)
    .catch(error => logger.warn('Task delivery cleanup deferred; execution recovery will continue', { error }))
  try { return await recoverActiveTaskGraphs(limit) }
  finally { await retirement }
}
