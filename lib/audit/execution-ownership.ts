import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const EXECUTION_LEASE_MS = 90_000
export type ExecutionOwnership = { auditId: string; token: string; generation: number; taskId?: string }
const ownership = new AsyncLocalStorage<ExecutionOwnership>()

export class ExecutionOwnershipLost extends Error {
  constructor() { super('This execution no longer owns the Audit'); this.name = 'ExecutionOwnershipLost' }
}

export function currentExecutionOwnership() { return ownership.getStore() }

export async function claimExecution(auditId: string, projectionOnly = false, prescription = false, resume = false): Promise<ExecutionOwnership | null> {
  const token = randomUUID()
  const now = new Date()
  const claimed = await prisma.audit.updateMany({
    where: { id: auditId, status: projectionOnly || prescription ? 'COMPLETED' : resume ? { notIn: ['COMPLETED', 'FAILED'] } : 'QUEUED',
      ...(prescription ? { aiReviewAt: null, triageAt: { not: null } } : !projectionOnly ? resume ? {} : { startedAt: null } : { improvementProjectedAt: null }),
      OR: [{ executionLeaseUntil: null }, { executionLeaseUntil: { lte: now } }] },
    data: { executionToken: token, executionGeneration: { increment: 1 },
      executionLeaseUntil: new Date(now.getTime() + EXECUTION_LEASE_MS) },
  })
  if (claimed.count !== 1) return null
  const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, select: { executionGeneration: true } })
  return { auditId, token, generation: audit.executionGeneration }
}

export async function renewExecution(owner: ExecutionOwnership): Promise<boolean> {
  const now = new Date()
  if (owner.taskId) {
    const renewed = await prisma.auditVerifierExecution.updateMany({
      where: { id: owner.taskId, auditId: owner.auditId, workToken: owner.token, workGeneration: owner.generation,
        workState: 'RUNNING', workLeaseUntil: { gt: now } },
      data: { workLeaseUntil: new Date(now.getTime() + EXECUTION_LEASE_MS) },
    })
    return renewed.count === 1
  }
  const renewed = await prisma.audit.updateMany({
    where: { id: owner.auditId, executionToken: owner.token, executionGeneration: owner.generation,
      executionLeaseUntil: { gt: now } },
    data: { executionLeaseUntil: new Date(now.getTime() + EXECUTION_LEASE_MS) },
  })
  return renewed.count === 1
}

/** The guard and the write share a transaction and hold the Audit row lock. */
async function assertExecutionOwner(tx: Prisma.TransactionClient, owner: ExecutionOwnership): Promise<void> {
  // Commands and workers share Project -> Audit -> task lock order. Removal
  // can fence queued work without deadlocking an account reservation.
  const projects = await tx.$queryRaw<Array<{ id: string; deletedAt: Date | null }>>`
    SELECT p."id", p."deletedAt" FROM "projects" p JOIN "audits" a ON a."projectId" = p."id"
    WHERE a."id" = ${owner.auditId} FOR UPDATE OF p
  `
  if (projects.some(project => project.deletedAt)) throw new ExecutionOwnershipLost()
  if (owner.taskId) {
    // Writers lock the parent before the task to preserve one lock order.
    const parent = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "audits" WHERE "id" = ${owner.auditId} AND "status" != 'FAILED' FOR UPDATE
    `
    if (parent.length !== 1) throw new ExecutionOwnershipLost()
    const task = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT e."id" FROM "audit_verifier_executions" e JOIN "audits" a ON a."id" = e."auditId"
      WHERE e."id" = ${owner.taskId} AND e."auditId" = ${owner.auditId}
        AND e."workToken" = ${owner.token} AND e."workGeneration" = ${owner.generation}
        AND e."workLeaseUntil" > clock_timestamp() AND e."workState" = 'RUNNING'
        AND (a."status" != 'COMPLETED' OR e."workKind" = 'finalize')
        AND (a."recoveryUntil" IS NULL OR a."recoveryUntil" > clock_timestamp() OR e."workKind" = 'finalize')
      FOR UPDATE OF e
    `
    if (task.length !== 1) throw new ExecutionOwnershipLost()
    return
  }
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "audits"
    WHERE "id" = ${owner.auditId} AND "executionToken" = ${owner.token}
      AND "executionGeneration" = ${owner.generation} AND "executionLeaseUntil" > clock_timestamp()
    FOR UPDATE
  `
  if (rows.length !== 1) throw new ExecutionOwnershipLost()
}

export function executionWrite<T>(write: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const owner = ownership.getStore()
  // Commands outside worker execution retain their existing transactional boundary.
  if (!owner) return write(prisma)
  return prisma.$transaction(async tx => {
    await assertExecutionOwner(tx, owner)
    return write(tx)
  })
}

export function executionTransaction<T>(
  write: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
): Promise<T> {
  const owner = ownership.getStore()
  return prisma.$transaction(async tx => {
    if (owner) await assertExecutionOwner(tx, owner)
    return write(tx)
  }, options)
}

export async function withExecutionOwnership<T>(owner: ExecutionOwnership, work: () => Promise<T>): Promise<T> {
  let lost = false
  let renewing = false
  const timer = setInterval(() => {
    if (renewing || lost) return
    renewing = true
    void renewExecution(owner).then(ok => { lost = !ok }).catch(() => { lost = true }).finally(() => { renewing = false })
  }, EXECUTION_LEASE_MS / 3)
  timer.unref?.()
  try {
    return await ownership.run(owner, work)
  } finally {
    clearInterval(timer)
    if (owner.taskId) {
      await prisma.auditVerifierExecution.updateMany({
        where: { id: owner.taskId, workToken: owner.token, workGeneration: owner.generation },
        data: { workLeaseUntil: new Date(0) },
      })
    } else {
    await prisma.audit.updateMany({
      where: { id: owner.auditId, executionToken: owner.token, executionGeneration: owner.generation },
      data: { executionLeaseUntil: new Date(0) },
    })
    }
  }
}

/** Expired execution is terminal, never an invitation to repeat a protected action. */
export async function recoverExpiredExecutions(limit = 25): Promise<number> {
  const now = new Date()
  const audits = await prisma.audit.findMany({
    where: { executionToken: { not: null }, executionLeaseUntil: { lte: now }, status: { notIn: ['COMPLETED', 'FAILED'] } },
    orderBy: [{ executionLeaseUntil: 'asc' }, { id: 'asc' }], take: Math.max(1, Math.min(100, limit)),
    select: { id: true, executionToken: true, executionGeneration: true },
  })
  let recovered = 0
  for (const audit of audits) {
    const changed = await prisma.audit.updateMany({
      where: { id: audit.id, executionToken: audit.executionToken, executionGeneration: audit.executionGeneration,
        executionLeaseUntil: { lte: now }, status: { notIn: ['COMPLETED', 'FAILED'] } },
      data: { status: 'FAILED', executionToken: null, executionLeaseUntil: null, completedAt: now,
        failureCode: 'EXECUTION_LEASE_EXPIRED', failureStage: 'worker',
        errorMsg: 'The worker stopped before this check completed. Retry starts a new execution; earlier evidence is preserved.' },
    })
    recovered += changed.count
    if (changed.count === 1) {
      const { markOutcomeRunsCouldNotVerify } = await import('@/lib/sites/application/run-reconciliation')
      await markOutcomeRunsCouldNotVerify(audit.id, 'EXECUTION_LEASE_EXPIRED', 'The worker stopped before this check completed.')
    }
  }
  return recovered
}
