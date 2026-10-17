import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ScanAccessUnavailable } from '../scan-access-grants'
import { scopeTaskArtifact } from './results'
import { getAuditTaskQueue } from '@/lib/queue/client'
import { queueForTask, priorityForTask } from './queues'
import { logUnrecordedPrescriptionCost, publishUnfinishedCoverage, recordSettledPrescriptionCost, settleFailedFinalization, settlePrescriptionAudit } from './incomplete'
import { executionTransaction, withExecutionOwnership, withExecutionSignal, currentExecutionOwnership, EXECUTION_LEASE_MS, ExecutionOwnershipLost } from '../execution-ownership'
import { recordProgress } from './events'
import { taskPlanSchema, taskInputSchema, taskJobSchema, taskArtifactSchema, taskIsSettled, validateTaskGraph,
  retryDecision, TaskFailure, ANALYSIS_RECOVERY_MS, MAX_TASKS_PER_AUDIT, COMPLETION_TASK_KINDS, runsAfterCompletion, type TaskPlan, type TaskKind } from './contracts'
import type { TaskHandler, TaskContext } from './registry'
import { getBrowserDiagnostics } from '../screenshot'
import { readWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { StorageUploadError, StorageNotConfiguredError } from '../pipeline-errors'
import { PageCaptureError } from '../browser/page-capture'

const DELIVERY_RECHECK_MS = 30_000

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
    const existing = await tx.auditVerifierExecution.findMany({ where: { auditId, targetKey: { startsWith: 'task:' } },
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
    if (additions.length) await tx.auditVerifierExecution.createMany({ data: additions.map(plan => ({
      auditId, targetKey: 'task:' + plan.key, scopeKey: plan.scope, pageUrl: plan.input.pageUrl, source: 'EXECUTION', status: 'PENDING',
      workKind: plan.kind, workInput: plan.input, workDependencies: plan.dependencies,
      workState: plan.dependencies.length ? 'WAITING' : 'READY', workRetryAt: new Date(), workDispatchState: 'PENDING',
    })), skipDuplicates: true })
    for (const update of updates) await tx.auditVerifierExecution.updateMany({
      where: { id: update.id, workState: 'WAITING' }, data: { workDependencies: update.dependencies },
    })
    await recordProgress(tx, auditId, { kind: 'plan', state: 'admitted' })
  })
}
export async function loadTasks(auditId: string) {
  const tasks = await prisma.auditVerifierExecution.findMany({
    where: { auditId, targetKey: { startsWith: 'task:' } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_TASKS_PER_AUDIT + 1,
  })
  if (tasks.length > MAX_TASKS_PER_AUDIT) throw new Error('Execution task limit exceeded')
  return tasks
}

export async function loadTaskGraph(auditId: string) {
  const tasks = await prisma.auditVerifierExecution.findMany({ where: { auditId, targetKey: { startsWith: 'task:' } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_TASKS_PER_AUDIT + 1,
    omit: { workResult: true, detail: true, evidenceReference: true } })
  if (tasks.length > MAX_TASKS_PER_AUDIT) throw new Error('Execution task limit exceeded')
  return tasks
}

export async function dispatchTask(taskId: string): Promise<boolean> {
  const now = new Date(), lease = new Date(now.getTime() + DELIVERY_RECHECK_MS)
  const won = await prisma.auditVerifierExecution.updateMany({
    where: { id: taskId, workState: 'READY',
      OR: [{ workDispatchLeaseUntil: null }, { workDispatchLeaseUntil: { lte: now } }],
      audit: { status: { not: 'FAILED' } },
      AND: [{ OR: [{ workRetryAt: null }, { workRetryAt: { lte: now } }] },
        { OR: [{ audit: { status: { not: 'COMPLETED' } } }, { workKind: { in: [...COMPLETION_TASK_KINDS] } }] }] },
    data: { workDispatchLeaseUntil: lease },
  })
  if (won.count !== 1) return false
  const task = await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: taskId } })
  if (task.workState !== 'READY' || task.workDispatchLeaseUntil?.getTime() !== lease.getTime()) return false
  const dispatchOwner = { id: taskId, workState: 'READY' as const, workGeneration: task.workGeneration, workDispatchLeaseUntil: lease }
  try {
    const input = taskInputSchema.parse(task.workInput)
    const resource = queueForTask(task.workKind as TaskKind, input)
    if (resource === 'browser' && !getBrowserDiagnostics().connected && !(await readWorkerHeartbeat().catch(() => null))?.browserOk) {
      await executionTransaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "audits" WHERE "id" = ${task.auditId} FOR UPDATE`
        const updated = await tx.auditVerifierExecution.updateMany({ where: dispatchOwner,
          data: { workState: 'RETRY_WAIT', workDispatchLeaseUntil: null, workDispatchState: 'PENDING',
            workRetryAt: new Date(Date.now() + 20_000), workErrorCode: 'BROWSER_UNHEALTHY',
            workRecoveryUntil: task.workRecoveryUntil ?? new Date(Date.now() + 30 * 60_000) } })
        if (updated.count) await recordProgress(tx, task.auditId, { taskId, kind: task.workKind!, state: 'RETRY_WAIT' })
      })
      return false
    }
    const queue = getAuditTaskQueue(resource)
    const jobId = taskId + '-g' + (task.workGeneration + 1)
    const existingJob = await queue.getJob(jobId)
    const existingState = existingJob ? await existingJob.getState() : null
    if (existingJob && (existingState === 'failed' || existingState === 'completed')) await existingJob.retry(existingState)
    else if (!existingJob) await queue.add('audit-task', { auditId: task.auditId, taskId, generation: task.workGeneration + 1 },
      { jobId, attempts: 1, removeOnComplete: 100, removeOnFail: 500,
        priority: priorityForTask(task.workKind as TaskKind, input, task.workAttempts) })
    // A delivered job can wait in a busy queue without occupying every recovery
    // batch. Recheck later so a lost Redis delivery still gets reconstructed.
    await prisma.auditVerifierExecution.updateMany({ where: dispatchOwner,
      data: { workDispatchState: 'SENT', workDispatchLeaseUntil: null, workRetryAt: new Date(Date.now() + DELIVERY_RECHECK_MS) } })
    return true
  } catch {
    await prisma.auditVerifierExecution.updateMany({ where: dispatchOwner,
      data: { workDispatchState: 'PENDING', workDispatchLeaseUntil: null, workRetryAt: new Date(Date.now() + 5000),
        workErrorCode: 'QUEUE_UNAVAILABLE' } })
    return false
  }
}

export async function reconcileTasks(auditId: string) {
  const audit = await prisma.audit.findUnique({ where: { id: auditId }, select: { createdAt: true, status: true, recoveryUntil: true, improvementProjectedAt: true } })
  if (!audit || audit.status === 'FAILED') return []
  const until = audit.recoveryUntil?.getTime() ?? audit.createdAt.getTime() + ANALYSIS_RECOVERY_MS
  const tasks = await loadTaskGraph(auditId), byKey = new Map(tasks.map(task => [task.targetKey.slice(5), task]))
  const ready: string[] = []
  for (const task of tasks) {
    const now = new Date()
    const admittedAt = task.workKind === 'prescription' ? task.createdAt.getTime() : audit.createdAt.getTime()
    const taskUntil = task.workKind === 'prescription' ? admittedAt + ANALYSIS_RECOVERY_MS : until
    if (taskIsSettled(task.workState)) continue
    if (audit.status === 'COMPLETED' && !runsAfterCompletion(task.workKind)) continue
    if ((now.getTime() >= taskUntil || task.workRecoveryUntil && now >= task.workRecoveryUntil) && task.workKind !== 'finalize') {
      const settled = await executionTransaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "audits" WHERE "id" = ${auditId} FOR UPDATE`
        const updated = await tx.auditVerifierExecution.updateMany({
          where: { id: task.id, workGeneration: task.workGeneration, workState: { notIn: ['COMPLETED', 'BLOCKED', 'EXHAUSTED'] } },
          data: { workState: 'EXHAUSTED', status: 'FAILED', workToken: null, workLeaseUntil: null, workErrorCode: 'RECOVERY_EXHAUSTED' },
        })
        if (updated.count) {
          await publishUnfinishedCoverage(tx, task, 'RECOVERY_EXHAUSTED')
          await recordProgress(tx, auditId, { taskId: task.id, kind: task.workKind!, state: 'EXHAUSTED' })
        }
        return updated.count
      })
      if (settled) {
        task.workState = 'EXHAUSTED'
        if (task.workKind === 'prescription') await recordSettledPrescriptionCost(auditId).catch(error => logUnrecordedPrescriptionCost(auditId, error))
      }
      continue
    }
    if (task.workState === 'RUNNING' && task.workLeaseUntil && task.workLeaseUntil <= now) {
      const decision = retryDecision({ now: now.getTime(), admittedAt,
        firstFailureAt: task.workRecoveryUntil ? task.workRecoveryUntil.getTime() - 30 * 60_000 : undefined,
        attempts: task.workAttempts, crash: true, retryable: true })
      const settled = await executionTransaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "audits" WHERE "id" = ${auditId} FOR UPDATE`
        const updated = await tx.auditVerifierExecution.updateMany({
          where: { id: task.id, workToken: task.workToken, workGeneration: task.workGeneration, workState: 'RUNNING', workLeaseUntil: { lte: now } },
          data: { workState: decision.retry ? 'RETRY_WAIT' : 'EXHAUSTED', status: 'FAILED', workToken: null,
            workLeaseUntil: null, workRecoveryUntil: new Date(decision.until), workRetryAt: new Date(decision.nextAt),
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
        task.workRetryAt = new Date(decision.nextAt)
        if (!decision.retry && task.workKind === 'prescription') await recordSettledPrescriptionCost(auditId).catch(error => logUnrecordedPrescriptionCost(auditId, error))
      }
      continue
    }
  }
  // Settle every expired obligation before evaluating readiness. A dependent
  // may precede its inputs in persisted order after discovery expands a graph.
  for (const task of tasks) {
    const now = new Date()
    if (taskIsSettled(task.workState)) continue
    if (audit.status === 'COMPLETED' && !runsAfterCompletion(task.workKind)) continue
    const dependenciesSettled = task.workDependencies.every(key => taskIsSettled(byKey.get(key)?.workState ?? null))
    if (task.workState === 'WAITING' && dependenciesSettled || task.workState === 'RETRY_WAIT' && task.workRetryAt && task.workRetryAt <= now) {
      const changed = await prisma.auditVerifierExecution.updateMany({
        where: { id: task.id, workGeneration: task.workGeneration, workState: task.workState },
        data: { workState: 'READY', status: 'PENDING', workRetryAt: now, workDispatchState: 'PENDING' },
      })
      if (changed.count) ready.push(task.id)
    } else if (task.workState === 'READY' && (!task.workRetryAt || task.workRetryAt <= now) &&
      (!task.workDispatchLeaseUntil || task.workDispatchLeaseUntil <= now)) ready.push(task.id)
  }
  if (tasks.some(task => ['check', 'search'].includes(task.workKind ?? '') && task.workState === 'COMPLETED'))
    await prisma.audit.updateMany({ where: { id: auditId, status: { in: ['QUEUED', 'CAPTURING'] } }, data: { status: 'CHECKING' } })
  // Old, due deliveries rotate behind undispatched work after each queue check.
  // Graph insertion order must not let a blocked resource starve other queues.
  const dueAt = new Map(tasks.map(task => [task.id, task.workRetryAt?.getTime() ?? 0]))
  const ordered = ready.sort((left, right) => dueAt.get(left)! - dueAt.get(right)!)
  // Reorder within resource slots, preserving other resources' opportunities
  // when either browser or PageSpeed dispatch is unavailable.
  const readyIds = new Set(ordered)
  const replacements = new Map<string, string>()
  for (const resource of ['browser', 'pagespeed'] as const) {
    const members = tasks.filter(task => readyIds.has(task.id)).flatMap(task => {
      const input = taskInputSchema.safeParse(task.workInput)
      return input.success && queueForTask(task.workKind as TaskKind, input.data) === resource
        ? [{ id: task.id, priority: priorityForTask(task.workKind as TaskKind, input.data, task.workAttempts) }] : []
    })
    const ids = new Set(members.map(task => task.id))
    members.sort((left, right) => left.priority - right.priority || dueAt.get(left.id)! - dueAt.get(right.id)!)
    let index = 0
    for (const id of ordered) if (ids.has(id)) replacements.set(id, members[index++].id)
  }
  return ordered.map(id => replacements.get(id) ?? id)
}

export async function executeTask(rawJob: unknown, handlers: Map<string, TaskHandler>) {
  const job = taskJobSchema.parse(rawJob)
  const original = await prisma.auditVerifierExecution.findFirst({
    where: { id: job.taskId, auditId: job.auditId, targetKey: { startsWith: 'task:' } }, include: { audit: true },
  })
  if (!original || !original.workKind || original.audit.status === 'FAILED' ||
    original.audit.status === 'COMPLETED' && !runsAfterCompletion(original.workKind)) return
  const handler = handlers.get(original.workKind)
  if (!handler) throw new Error('Unregistered execution task')
  const token = randomUUID(), now = new Date()
  const input = taskInputSchema.parse(original.workInput)
  const claimed = await prisma.$transaction(async tx => {
    const projects = await tx.$queryRaw<Array<{ deletedAt: Date | null }>>`
      SELECT p."deletedAt" FROM "projects" p JOIN "audits" a ON a."projectId" = p."id"
      WHERE a."id" = ${job.auditId} FOR UPDATE OF p`
    if (projects.some(project => project.deletedAt)) return { count: 0 }
    await tx.$queryRaw`SELECT "id" FROM "audits" WHERE "id" = ${job.auditId} FOR UPDATE`
    if (original.workKind === 'prescription') {
      const audit = await tx.audit.findUniqueOrThrow({ where: { id: job.auditId },
        select: { executionLeaseUntil: true, status: true, triageAt: true, completedAt: true } })
      if (audit.executionLeaseUntil && audit.executionLeaseUntil > now) {
        await tx.auditVerifierExecution.updateMany({ where: { id: original.id, workState: 'READY', workGeneration: job.generation - 1 },
          data: { workState: 'RETRY_WAIT', workRetryAt: new Date(Math.min(audit.executionLeaseUntil.getTime(), now.getTime() + 5000)),
            workErrorCode: 'EXECUTION_BUSY', workDispatchState: 'PENDING', workDispatchLeaseUntil: null } })
        return { count: 0 }
      }
      // Restore legacy prescription's recorded terminal state only after the
      // original writer's lease expires. Its expired token remains fenced.
      if (audit.status === 'JUDGING' && audit.triageAt && audit.completedAt) await tx.audit.update({ where: { id: job.auditId }, data: { status: 'COMPLETED', progress: 100 } })
    }
    if (input.fixtureId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'fixture:' + input.fixtureId}))`
      const activeFixture = await tx.auditVerifierExecution.findFirst({ where: { id: { not: original.id },
        workState: 'RUNNING', workLeaseUntil: { gt: now }, workInput: { path: ['fixtureId'], equals: input.fixtureId } }, select: { id: true } })
      if (activeFixture) {
        await tx.auditVerifierExecution.updateMany({ where: { id: original.id, workState: 'READY', workGeneration: job.generation - 1 },
          data: { workState: 'RETRY_WAIT', workRetryAt: new Date(Date.now() + 5000), workErrorCode: 'FIXTURE_BUSY', workDispatchState: 'PENDING', workDispatchLeaseUntil: null } })
        await recordProgress(tx, job.auditId, { taskId: original.id, kind: original.workKind!, state: 'RETRY_WAIT' })
        return { count: 0 }
      }
    }
    return tx.auditVerifierExecution.updateMany({
    where: { id: original.id, auditId: job.auditId, workState: 'READY', workGeneration: job.generation - 1,
      audit: { status: { not: 'FAILED' } },
      OR: [{ audit: { status: { not: 'COMPLETED' } } }, { workKind: { in: [...COMPLETION_TASK_KINDS] } }] },
    data: { workState: 'RUNNING', status: 'RUNNING', workToken: token, workGeneration: { increment: 1 },
      workAttempts: { increment: 1 }, workLeaseUntil: new Date(now.getTime() + EXECUTION_LEASE_MS), workDispatchLeaseUntil: null },
    })
  })
  if (claimed.count !== 1) return
  const task = await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: original.id } })
  const owner = { auditId: job.auditId, taskId: task.id, token, generation: job.generation }
  await withExecutionOwnership(owner, async () => {
    try {
    await executionTransaction(async tx => {
      if (handler.kind === 'judge') await tx.audit.updateMany({ where: { id: job.auditId,
        status: { in: ['QUEUED', 'CAPTURING', 'CHECKING'] } }, data: { status: 'JUDGING' } })
      if (handler.kind === 'finalize') await tx.audit.updateMany({ where: { id: job.auditId,
        status: { notIn: ['COMPLETED', 'FAILED'] } }, data: { status: 'FINALIZING' } })
      await recordProgress(tx, job.auditId, { taskId: task.id, kind: handler.kind, state: 'RUNNING' })
    })
      const requiredKeys = ['finalize', 'discovery', 'cross-page', 'bindings'].includes(handler.kind) ? []
        : handler.kind === 'judge' ? task.workDependencies.filter(key => key.endsWith(':browser') || key.endsWith(':captures')) : task.workDependencies
      const tasks = requiredKeys.length ? await prisma.auditVerifierExecution.findMany({ where: { auditId: job.auditId,
        targetKey: { in: requiredKeys.map(key => 'task:' + key) } }, take: requiredKeys.length }) : []
      const byKey = new Map(tasks.map(item => [item.targetKey.slice(5), item]))
      const input = taskInputSchema.parse(task.workInput)
      const timeoutMs = typeof handler.timeoutMs === 'function' ? handler.timeoutMs(original.audit, input) : handler.timeoutMs
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TaskFailure('TASK_BUDGET_INVALID', false)
      const context: TaskContext = { audit: original.audit, task, input,
        deadline: Math.min(Date.now() + timeoutMs, original.audit.recoveryUntil?.getTime() ?? original.audit.createdAt.getTime() + ANALYSIS_RECOVERY_MS),
        dependencies: new Map(task.workDependencies.flatMap(key => byKey.has(key) ? [[key, byKey.get(key)!] as const] : [])) }
      if (runsAfterCompletion(handler.kind)) context.deadline = Math.min(Date.now() + timeoutMs,
        handler.kind === 'prescription' ? Math.min(task.createdAt.getTime() + ANALYSIS_RECOVERY_MS, task.workRecoveryUntil?.getTime() ?? Infinity) : Infinity)
      await withinTaskDeadline(context, async check => {
        if (handler.replay === 'protected' && task.workAttempts > 1 && !await handler.reconcile!(context))
          throw new TaskFailure('PROTECTED_EFFECT_UNRESOLVED', false)
        check()
        const result = taskArtifactSchema.parse(scopeTaskArtifact(await handler.evaluate(context), original.audit.executionSpec))
        handler.validateResult(result)
        check()
        await executionTransaction(async tx => {
          await handler.commit?.(context, result, tx)
          check()
          await tx.auditPipelineEvent.create({ data: {
            auditId: job.auditId, executionId: task.id, traceId: job.auditId, attempt: task.workAttempts,
            stage: 'checking', event: 'task_observation_committed', status: 'completed',
            detail: { version: 1, taskId: task.id, generation: job.generation, kind: handler.kind,
              collectedAt: result.collectedAt, evidenceReference: task.id,
              ...(handler.kind === 'check' || handler.kind === 'search' || handler.kind === 'google' ? { observations: result.data } : {}) },
          } })
          await tx.auditVerifierExecution.update({ where: { id: task.id }, data: {
            workResult: result as Prisma.InputJsonValue, workState: 'COMPLETED', status: 'COMPLETED',
            workErrorCode: null, workLeaseUntil: null,
          } })
          if (handler.kind === 'prescription') await settlePrescriptionAudit(tx, job.auditId)
          await recordProgress(tx, job.auditId, { taskId: task.id, kind: handler.kind, state: 'COMPLETED', observationReference: task.id })
          check()
        })
      })
    } catch (error) {
      if (error instanceof ExecutionOwnershipLost) return
      const failure = classifyTaskFailure(error)
      const decision = retryDecision({ now: Date.now(), admittedAt: task.workKind === 'prescription' ? task.createdAt.getTime() : original.audit.createdAt.getTime(),
        firstFailureAt: task.workRecoveryUntil ? task.workRecoveryUntil.getTime() - 30 * 60_000 : undefined,
        attempts: task.workAttempts, crash: failure.crash, retryable: failure.retryable, retryAfterMs: failure.retryAfterMs })
      try {
        await executionTransaction(async tx => {
          if (error instanceof PageCaptureError && !failure.retryable) await tx.auditPipelineEvent.create({ data: {
            auditId: job.auditId, executionId: task.id, traceId: job.auditId, attempt: task.workAttempts,
            stage: 'checking', event: 'page_response_unavailable', status: 'partial',
            detail: { version: 1, taskId: task.id, generation: job.generation, kind: handler.kind,
              code: error.code, httpStatus: error.httpStatus, contentType: error.contentType, finalUrl: error.finalUrl },
          } })
          await tx.auditVerifierExecution.update({ where: { id: task.id }, data: {
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
  const ready = await reconcileTasks(job.auditId)
  await dispatchReadyTasks(ready)
}

export function classifyTaskFailure(error: unknown): TaskFailure {
  if (error instanceof ScanAccessUnavailable) return new TaskFailure(error.code, false)
  if (error instanceof TaskFailure) return error
  // A refused navigation is a completed observation of unavailable scope. A
  // fresh scheduled run can observe recovery; repeating secondary browser work
  // inside this run cannot replace its already recorded page capture evidence.
  if (error instanceof PageCaptureError && ['HTTP_ERROR', 'HTTP_FORBIDDEN', 'HTTP_RATE_LIMIT', 'NON_HTML_RESPONSE'].includes(error.code))
    return new TaskFailure('PAGE_' + error.code, false)
  if (error instanceof StorageNotConfiguredError) return new TaskFailure('STORAGE_NOT_CONFIGURED', false)
  if (error instanceof StorageUploadError) return new TaskFailure('STORAGE_UPLOAD_INTERRUPTED', true)
  if (error instanceof Prisma.PrismaClientInitializationError || error instanceof Prisma.PrismaClientKnownRequestError &&
    ['P1001', 'P1002', 'P1017', 'P2024', 'P2034'].includes(error.code)) return new TaskFailure('PERSISTENCE_UNAVAILABLE', true)
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null
  if (typeof code === 'string' && ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH'].includes(code))
    return new TaskFailure('DEPENDENCY_INTERRUPTED', true)
  return new TaskFailure('TASK_INTERRUPTED', true, undefined, true)
}

/** Small fair dispatch batches prevent one Site, or a down queue, from occupying a recovery pass. */
export async function dispatchReadyTasks(ids: string[]) {
  let sent = 0
  for (let offset = 0; offset < Math.min(ids.length, 8); offset += 4) {
    const batch = ids.slice(offset, offset + 4)
    const results = await Promise.allSettled(batch.map(dispatchTask))
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') { if (result.value) sent++ }
      else logger.error('Task dispatch interrupted; retained ledger will be retried', result.reason, { taskId: batch[index] })
    }
  }
  return sent
}

export async function recoverProgressiveTasks(limit = 25) {
  const audits = await prisma.audit.findMany({
    where: { status: { not: 'FAILED' },
      startedAt: { not: null },
      OR: [{ executionSpec: { path: ['engine'], equals: 'progressive-v1' }, OR: [{ status: { not: 'COMPLETED' } },
        { verifierExecutions: { some: { workKind: 'finalize', workState: { notIn: ['COMPLETED', 'BLOCKED', 'EXHAUSTED'] } } } }] },
        { verifierExecutions: { some: { workKind: 'prescription', workState: { notIn: ['COMPLETED', 'BLOCKED', 'EXHAUSTED'] } } } }],
      dispatchNextAt: { lte: new Date() } },
    orderBy: [{ dispatchNextAt: 'asc' }, { id: 'asc' }], take: Math.min(100, Math.max(1, limit)),
    select: { id: true },
  })
  let dispatched = 0
  const deadline = Date.now() + 10_000
  for (const audit of audits) {
    if (Date.now() >= deadline) break
    // Round-robin durable dispatch scheduling. Sleeping older analyses cannot
    // monopolize a bounded recovery batch while younger Sites await service.
    try {
      const admitted = await prisma.audit.updateMany({ where: { id: audit.id, dispatchNextAt: { lte: new Date() } },
        data: { dispatchNextAt: new Date(Date.now() + 10_000) } })
      if (!admitted.count) continue
      dispatched += await dispatchReadyTasks(await reconcileTasks(audit.id))
    } catch (error) { logger.error('Audit task recovery interrupted; retained graph will be retried', error, { auditId: audit.id }) }
  }
  return dispatched
}
