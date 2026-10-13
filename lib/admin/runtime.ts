import { randomUUID } from 'node:crypto'
import { Queue, Worker } from 'bullmq'
import { Prisma, type AdminOperation } from '@prisma/client'
import { prisma } from '@/lib/db'
import { createQueueRedis, createWorkerRedis } from '@/lib/queue/redis'
import { createTimerScheduler } from '@/lib/queue/timer-scheduler'
import { logger } from '@/lib/logger'
import { AdminActionError, AdminDeferredAction, AdminOutcomeUnknown } from './errors'
import { appendAdminActivity } from './activity'
import { adminOperationActor, decodedAdminInput, lockAdminTarget } from './action-service'
import { assertAdminActor, redactAdminText, requireRecentAdminAuthentication } from './security'
import { actionNeedsRecentAuthentication, resolveAdminTarget } from './targets'
import { isDatabaseAdminAction, performAdminDatabaseAction } from './database-actions'
import { performAdminExternalAction } from './external-actions'
import type { AdminActionRequest } from './contracts'

const OPERATION_LEASE_MS = 5 * 60_000
let queue: Queue | undefined
function adminQueue() {
  if (!queue) {
    queue = new Queue('admin-operations', {
      connection: createQueueRedis(),
      defaultJobOptions: { attempts: 1, removeOnComplete: true, removeOnFail: true },
    })
    queue.on('error', (error) =>
      logger.error('Admin queue unavailable', { message: redactAdminText(error.message) }),
    )
  }
  return queue
}

export async function dispatchAdminOperation(id: string) {
  const operation = await prisma.adminOperation.findUnique({
    where: { id },
    select: { id: true, status: true, attempts: true },
  })
  if (!operation || operation.status !== 'QUEUED') return
  try {
    await adminQueue().add(
      'execute',
      { operationId: id },
      { jobId: `admin-${id}-${operation.attempts}` },
    )
  } catch (error) {
    logger.error('Admin dispatch unavailable; durable admission retained', {
      operationId: id,
      error: error instanceof Error ? redactAdminText(error.message) : 'Dispatch unavailable',
    })
    await prisma.adminOperation.updateMany({
      where: { id, status: 'QUEUED' },
      data: {
        errorCode: 'DISPATCH_PENDING',
        errorMessage: 'Dispatch is unavailable. The admitted action remains queued.',
      },
    })
  }
}

async function validateExecution(
  tx: Prisma.TransactionClient,
  operation: AdminOperation,
  input: Record<string, unknown>,
) {
  await assertAdminActor(tx, adminOperationActor(operation))
  if (operation.attempts === 1) {
    if (operation.intentExpiresAt <= new Date())
      throw new AdminActionError(
        'Confirmation expired before execution. Review a new action.',
        409,
        'INTENT_EXPIRED',
      )
    if (actionNeedsRecentAuthentication(operation.action as import('./contracts').AdminAction))
      requireRecentAdminAuthentication(adminOperationActor(operation))
  }
  await lockAdminTarget(tx, operation.targetType, operation.targetId)
  const target = await resolveAdminTarget(
    {
      action: operation.action,
      targetId: operation.targetId,
      reason: operation.reason,
      input,
    } as AdminActionRequest,
    tx,
  )
  if (target.revision !== operation.expectedRevision || target.ownerId !== operation.ownerId)
    throw new AdminActionError(
      'This record changed before execution. Review a new action.',
      409,
      'TARGET_CHANGED',
    )
}

async function completeOperation(
  tx: Prisma.TransactionClient,
  operation: AdminOperation,
  result: Prisma.InputJsonObject,
) {
  const completed = await tx.adminOperation.updateMany({
    where: { id: operation.id, status: 'RUNNING', executionToken: operation.executionToken },
    data: {
      status: 'SUCCEEDED',
      result,
      errorCode: null,
      errorMessage: null,
      completedAt: new Date(),
      leaseUntil: null,
      executionToken: null,
      ...(['SUPPORT_REPLY', 'LEAD_UPDATE'].includes(operation.action)
        ? {
            input:
              operation.action === 'SUPPORT_REPLY'
                ? { messageId: result.messageId }
                : { contentCleared: true },
          }
        : {}),
    },
  })
  if (!completed.count)
    throw new AdminOutcomeUnknown(
      'The action’s execution lease changed before its outcome was recorded.',
    )
  await appendAdminActivity(tx, operation, 'COMPLETED', result)
}

export async function executeAdminOperation(id: string) {
  const token = randomUUID(),
    now = new Date()
  const claimed = await prisma.adminOperation.updateMany({
    where: { id, status: 'QUEUED', OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
    data: {
      status: 'RUNNING',
      executionToken: token,
      leaseUntil: new Date(now.getTime() + OPERATION_LEASE_MS),
      attempts: { increment: 1 },
      errorCode: null,
      errorMessage: null,
    },
  })
  if (!claimed.count) return
  const operation = await prisma.adminOperation.findUniqueOrThrow({ where: { id } })
  try {
    const input = decodedAdminInput(operation)
    await prisma.$transaction((tx) =>
      appendAdminActivity(tx, operation, 'STARTED', { attempt: operation.attempts }),
    )
    if (isDatabaseAdminAction(operation.action)) {
      await prisma.$transaction(
        async (tx) => {
          await validateExecution(tx, operation, input)
          const result = await performAdminDatabaseAction(tx, operation, input)
          await completeOperation(tx, operation, result)
        },
        { timeout: 30_000 },
      )
    } else {
      await prisma.$transaction((tx) => validateExecution(tx, operation, input), {
        timeout: 15_000,
      })
      const result = await performAdminExternalAction(operation, input)
      await prisma.$transaction((tx) => completeOperation(tx, operation, result))
    }
  } catch (error) {
    const deferred = error instanceof AdminDeferredAction
    const unknown =
      error instanceof AdminOutcomeUnknown ||
      (!isDatabaseAdminAction(operation.action) && !(error instanceof AdminActionError))
    const status = deferred ? 'QUEUED' : unknown ? 'INDETERMINATE' : 'FAILED'
    const code = error instanceof AdminActionError ? error.code : 'ADMIN_EXECUTION_ERROR'
    const message = redactAdminText(
      error instanceof Error ? error.message : 'The action could not be completed.',
    )
    await prisma.$transaction(async (tx) => {
      const settled = await tx.adminOperation.updateMany({
        where: { id, status: 'RUNNING', executionToken: token },
        data: {
          status,
          ...(['SUPPORT_REPLY', 'LEAD_UPDATE'].includes(operation.action)
            ? { input: { contentCleared: true } }
            : {}),
          errorCode: code,
          errorMessage: message,
          executionToken: null,
          leaseUntil: deferred ? new Date(Date.now() + 15_000) : null,
          completedAt: deferred ? null : new Date(),
          ...(deferred ? { result: error.progress as Prisma.InputJsonObject } : {}),
        },
      })
      if (settled.count)
        await appendAdminActivity(
          tx,
          operation,
          deferred ? 'WAITING' : unknown ? 'OUTCOME_UNCONFIRMED' : 'FAILED',
          { code, message, ...(deferred ? error.progress : {}) },
        )
    })
  }
}

export async function sweepAdminOperations() {
  const now = new Date()
  const expired = await prisma.adminOperation.findMany({
    where: { status: 'RUNNING', leaseUntil: { lt: now } },
    take: 20,
  })
  for (const operation of expired)
    await prisma.$transaction(async (tx) => {
      const changed = await tx.adminOperation.updateMany({
        where: {
          id: operation.id,
          status: 'RUNNING',
          executionToken: operation.executionToken,
          leaseUntil: { lt: now },
        },
        data: {
          status: 'INDETERMINATE',
          executionToken: null,
          leaseUntil: null,
          errorCode: 'EXECUTION_INTERRUPTED',
          errorMessage:
            'Execution was interrupted. Reconcile the recorded outcome before another action.',
        },
      })
      if (changed.count)
        await appendAdminActivity(tx, operation, 'INTERRUPTED', { attempt: operation.attempts })
    })
  const pending = await prisma.adminOperation.findMany({
    where: { status: 'QUEUED', OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { id: true },
  })
  for (const operation of pending) await dispatchAdminOperation(operation.id)
}

export function startAdminOperationRuntime() {
  const scheduler = createTimerScheduler((error) =>
    logger.error('Admin operation recovery failed', error),
  )
  const worker = new Worker(
    'admin-operations',
    async (job) => executeAdminOperation((job.data as { operationId: string }).operationId),
    {
      connection: createWorkerRedis(),
      concurrency: 2,
      lockDuration: OPERATION_LEASE_MS,
      maxStalledCount: 0,
    },
  )
  worker.on('error', (error) => logger.error('Admin worker unavailable', error))
  scheduler.schedule(sweepAdminOperations, 1000)
  scheduler.schedule(sweepAdminOperations, 10_000, true)
  return {
    async close() {
      await Promise.all([scheduler.stop(), worker.close()])
      await queue?.close()
      queue = undefined
    },
  }
}
