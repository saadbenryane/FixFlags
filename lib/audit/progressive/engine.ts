import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { scopeTaskArtifact } from './results'
import { getAuditTaskQueue } from '@/lib/queue/client'
import { queueForTask } from './queues'
import { publishUnfinishedCoverage, settleFailedFinalization } from './incomplete'
import { executionTransaction, withExecutionOwnership, EXECUTION_LEASE_MS, ExecutionOwnershipLost } from '../execution-ownership'
import { recordProgress } from './events'
import { taskPlanSchema, taskInputSchema, taskJobSchema, taskArtifactSchema, taskIsSettled, validateTaskGraph,
  retryDecision, TaskFailure, ANALYSIS_RECOVERY_MS, MAX_TASKS_PER_AUDIT, type TaskPlan, type TaskKind } from './contracts'
import type { TaskHandler, TaskContext } from './registry'
import { getBrowserDiagnostics } from '../screenshot'
import { readWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { StorageUploadError, StorageNotConfiguredError } from '../pipeline-errors'
import { PageCaptureError } from '../browser/page-capture'

const DELIVERY_RECHECK_MS = 30_000

export async function persistTaskPlan(auditId: string, plans: TaskPlan[]) {
  validateTaskGraph(plans)
  return executionTransaction(async tx => {
    const parent = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "audits" WHERE "id" = ${auditId} FOR UPDATE`
    if (!parent.length) throw new Error('Execution not found')
    for (const plan of plans) {
      const valid = taskPlanSchema.parse(plan), targetKey = 'task:' + valid.key
      await tx.auditVerifierExecution.upsert({
        where: { auditId_targetKey_scopeKey: { auditId, targetKey, scopeKey: valid.scope } },
        create: { auditId, targetKey, scopeKey: valid.scope, pageUrl: valid.input.pageUrl, source: 'EXECUTION', status: 'PENDING',
          workKind: valid.kind, workInput: valid.input, workDependencies: valid.dependencies,
          workState: valid.dependencies.length ? 'WAITING' : 'READY', workRetryAt: new Date(), workDispatchState: 'PENDING' },
        update: {},
      })
      if (valid.kind === 'finalize' || valid.kind === 'cross-page') await tx.auditVerifierExecution.updateMany({
        where: { auditId, targetKey, scopeKey: valid.scope, workState: 'WAITING' },
        data: { workDependencies: valid.dependencies },
      })
    }
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
        { OR: [{ audit: { status: { not: 'COMPLETED' } } }, { workKind: 'finalize' }] }] },
    data: { workDispatchLeaseUntil: lease },
  })
  if (won.count !== 1) return false
  const task = await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: taskId } })
  if (task.workState !== 'READY' || task.workDispatchLeaseUntil?.getTime() !== lease.getTime()) return false
  const dispatchOwner = { id: taskId, workState: 'READY' as const, workGeneration: task.workGeneration, workDispatchLeaseUntil: lease }
  try {
    const resource = queueForTask(task.workKind as TaskKind, taskInputSchema.parse(task.workInput))
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
        priority: task.workKind === 'http' ? 1 : task.workKind === 'check' ? 2 : 3 })
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
    if (taskIsSettled(task.workState)) continue
    if (audit.status === 'COMPLETED' && task.workKind !== 'finalize') continue
    if ((now.getTime() >= until || task.workRecoveryUntil && now >= task.workRecoveryUntil) && task.workKind !== 'finalize') {
      await executionTransaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "audits" WHERE "id" = ${auditId} FOR UPDATE`
        const updated = await tx.auditVerifierExecution.updateMany({
          where: { id: task.id, workGeneration: task.workGeneration, workState: { notIn: ['COMPLETED', 'BLOCKED', 'EXHAUSTED'] } },
          data: { workState: 'EXHAUSTED', status: 'FAILED', workToken: null, workLeaseUntil: null, workErrorCode: 'RECOVERY_EXHAUSTED' },
        })
        if (updated.count) {
          await publishUnfinishedCoverage(tx, task, 'RECOVERY_EXHAUSTED')
          await recordProgress(tx, auditId, { taskId: task.id, kind: task.workKind!, state: 'EXHAUSTED' })
        }
      })
      continue
    }
    if (task.workState === 'RUNNING' && task.workLeaseUntil && task.workLeaseUntil <= now) {
      const decision = retryDecision({ now: now.getTime(), admittedAt: audit.createdAt.getTime(),
        firstFailureAt: task.workRecoveryUntil ? task.workRecoveryUntil.getTime() - 30 * 60_000 : undefined,
        attempts: task.workAttempts, crash: true, retryable: true })
      await executionTransaction(async tx => {
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
      })
      continue
    }
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
  return ready.sort((left, right) => dueAt.get(left)! - dueAt.get(right)!)
}

export async function executeTask(rawJob: unknown, handlers: Map<string, TaskHandler>) {
  const job = taskJobSchema.parse(rawJob)
  const original = await prisma.auditVerifierExecution.findFirst({
    where: { id: job.taskId, auditId: job.auditId, targetKey: { startsWith: 'task:' } }, include: { audit: true },
  })
  if (!original || !original.workKind || original.audit.status === 'FAILED' ||
    original.audit.status === 'COMPLETED' && original.workKind !== 'finalize') return
  const handler = handlers.get(original.workKind)
  if (!handler) throw new Error('Unregistered execution task')
  const token = randomUUID(), now = new Date()
  const input = taskInputSchema.parse(original.workInput)
  const claimed = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "audits" WHERE "id" = ${job.auditId} FOR UPDATE`
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
      OR: [{ audit: { status: { not: 'COMPLETED' } } }, { workKind: 'finalize' }] },
    data: { workState: 'RUNNING', status: 'RUNNING', workToken: token, workGeneration: { increment: 1 },
      workAttempts: { increment: 1 }, workLeaseUntil: new Date(now.getTime() + EXECUTION_LEASE_MS), workDispatchLeaseUntil: null },
    })
  })
  if (claimed.count !== 1) return
  const task = await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: original.id } })
  const owner = { auditId: job.auditId, taskId: task.id, token, generation: job.generation }
  await withExecutionOwnership(owner, async () => {
    await executionTransaction(async tx => {
      if (handler.kind === 'judge') await tx.audit.updateMany({ where: { id: job.auditId,
        status: { in: ['QUEUED', 'CAPTURING', 'CHECKING'] } }, data: { status: 'JUDGING' } })
      if (handler.kind === 'finalize') await tx.audit.updateMany({ where: { id: job.auditId,
        status: { notIn: ['COMPLETED', 'FAILED'] } }, data: { status: 'FINALIZING' } })
      await recordProgress(tx, job.auditId, { taskId: task.id, kind: handler.kind, state: 'RUNNING' })
    })
    try {
      const requiredKeys = ['finalize', 'discovery', 'cross-page', 'bindings'].includes(handler.kind) ? []
        : handler.kind === 'judge' ? task.workDependencies.filter(key => key.endsWith(':browser') || key.endsWith(':captures')) : task.workDependencies
      const tasks = requiredKeys.length ? await prisma.auditVerifierExecution.findMany({ where: { auditId: job.auditId,
        targetKey: { in: requiredKeys.map(key => 'task:' + key) } }, take: requiredKeys.length }) : []
      const byKey = new Map(tasks.map(item => [item.targetKey.slice(5), item]))
      const context: TaskContext = { audit: original.audit, task, input: taskInputSchema.parse(task.workInput),
        deadline: Math.min(Date.now() + handler.timeoutMs, original.audit.recoveryUntil?.getTime() ?? original.audit.createdAt.getTime() + ANALYSIS_RECOVERY_MS),
        dependencies: new Map(task.workDependencies.flatMap(key => byKey.has(key) ? [[key, byKey.get(key)!] as const] : [])) }
      if (handler.kind === 'finalize') context.deadline = Date.now() + handler.timeoutMs
      if (handler.replay === 'protected' && task.workAttempts > 1 && !await handler.reconcile!(context))
        throw new TaskFailure('PROTECTED_EFFECT_UNRESOLVED', false)
      const result = taskArtifactSchema.parse(scopeTaskArtifact(await handler.evaluate(context), original.audit.executionSpec))
      handler.validateResult(result)
      await executionTransaction(async tx => {
        await handler.commit?.(context, result, tx)
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
        await recordProgress(tx, job.auditId, { taskId: task.id, kind: handler.kind, state: 'COMPLETED', observationReference: task.id })
      })
    } catch (error) {
      if (error instanceof ExecutionOwnershipLost) return
      const failure = classifyTaskFailure(error)
      const decision = retryDecision({ now: Date.now(), admittedAt: original.audit.createdAt.getTime(),
        firstFailureAt: task.workRecoveryUntil ? task.workRecoveryUntil.getTime() - 30 * 60_000 : undefined,
        attempts: task.workAttempts, crash: failure.crash, retryable: failure.retryable, retryAfterMs: failure.retryAfterMs })
      await executionTransaction(async tx => {
        if (error instanceof PageCaptureError && !failure.retryable) await tx.auditPipelineEvent.create({ data: {
          auditId: job.auditId, executionId: task.id, traceId: job.auditId, attempt: task.workAttempts,
          stage: 'checking', event: 'page_response_unavailable', status: 'partial',
          detail: { version: 1, taskId: task.id, generation: job.generation, kind: handler.kind,
            code: error.code, httpStatus: error.httpStatus, contentType: error.contentType, finalUrl: error.finalUrl },
        } })
        if (!decision.retry && !failure.code.endsWith('_NOT_APPLICABLE')) await publishUnfinishedCoverage(tx, task, failure.code)
        if (!decision.retry) await settleFailedFinalization(tx, task)
        await tx.auditVerifierExecution.update({ where: { id: task.id }, data: {
          workState: decision.retry ? 'RETRY_WAIT' : failure.retryable ? 'EXHAUSTED' : 'BLOCKED',
          status: failure.code.endsWith('_NOT_APPLICABLE') ? 'NOT_APPLICABLE' : 'FAILED',
          workRetryAt: new Date(decision.nextAt), workRecoveryUntil: new Date(decision.until), workLeaseUntil: null,
          workErrorCode: failure.code, workDispatchState: 'PENDING',
        } })
        await recordProgress(tx, job.auditId, { taskId: task.id, kind: handler.kind,
          state: decision.retry ? 'RETRY_WAIT' : failure.retryable ? 'EXHAUSTED' : 'BLOCKED' })
      })
    }
  })
  const ready = await reconcileTasks(job.auditId)
  await dispatchReadyTasks(ready)
}

export function classifyTaskFailure(error: unknown): TaskFailure {
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
  for (let offset = 0; offset < Math.min(ids.length, 8); offset += 4)
    for (const result of await Promise.all(ids.slice(offset, offset + 4).map(dispatchTask))) if (result) sent++
  return sent
}

export async function recoverProgressiveTasks(limit = 25) {
  const audits = await prisma.audit.findMany({
    where: { status: { not: 'FAILED' },
      startedAt: { not: null },
      OR: [{ status: { not: 'COMPLETED' } }, { verifierExecutions: { some: { workKind: 'finalize', workState: { notIn: ['COMPLETED', 'BLOCKED', 'EXHAUSTED'] } } } }],
      dispatchNextAt: { lte: new Date() },
      executionSpec: { path: ['engine'], equals: 'progressive-v1' } },
    orderBy: [{ dispatchNextAt: 'asc' }, { id: 'asc' }], take: Math.min(100, Math.max(1, limit)),
    select: { id: true },
  })
  let dispatched = 0
  const deadline = Date.now() + 10_000
  for (const audit of audits) {
    if (Date.now() >= deadline) break
    // Round-robin durable dispatch scheduling. Sleeping older analyses cannot
    // monopolize a bounded recovery batch while younger Sites await service.
    const admitted = await prisma.audit.updateMany({ where: { id: audit.id, dispatchNextAt: { lte: new Date() } },
      data: { dispatchNextAt: new Date(Date.now() + 10_000) } })
    if (!admitted.count) continue
    dispatched += await dispatchReadyTasks(await reconcileTasks(audit.id))
  }
  return dispatched
}
