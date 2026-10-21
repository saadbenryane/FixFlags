import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const EXECUTION_LEASE_MS = 90_000
export type ExecutionOwnership = { auditId: string; token: string; generation: number; taskId?: string; signal?: AbortSignal }
const ownership = new AsyncLocalStorage<ExecutionOwnership>()

export class ExecutionOwnershipLost extends Error {
  constructor() { super('This execution no longer owns the Audit'); this.name = 'ExecutionOwnershipLost' }
}

export function currentExecutionOwnership() { return ownership.getStore() }

function assertExecutionActive(owner: ExecutionOwnership | undefined) {
  if (owner?.signal?.aborted) throw new ExecutionOwnershipLost()
}

/** Cancellation follows nested execution scopes and their asynchronous callbacks. */
export function withExecutionSignal<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  const owner = ownership.getStore()
  if (!owner) return work()
  const combined = owner.signal && owner.signal !== signal ? AbortSignal.any([owner.signal, signal]) : signal
  return ownership.run({ ...owner, signal: combined }, work)
}

export async function claimExecution(auditId: string, { projectionOnly = false, resume = false }: { projectionOnly?: boolean; resume?: boolean } = {}): Promise<ExecutionOwnership | null> {
  assertExecutionActive(ownership.getStore())
  const token = randomUUID()
  const now = new Date()
  const claimed = await prisma.audit.updateMany({
    where: { id: auditId, status: projectionOnly ? 'COMPLETED' : resume ? { notIn: ['COMPLETED', 'FAILED'] } : 'QUEUED',
      ...(!projectionOnly ? resume ? {} : { startedAt: null } : { improvementProjectedAt: null }),
      OR: [{ executionLeaseUntil: null }, { executionLeaseUntil: { lte: now } }] },
    data: { executionToken: token, executionGeneration: { increment: 1 },
      executionLeaseUntil: new Date(now.getTime() + EXECUTION_LEASE_MS) },
  })
  if (claimed.count !== 1) return null
  const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, select: { executionGeneration: true } })
  return { auditId, token, generation: audit.executionGeneration }
}

const OWNERSHIP_WATCH_MS = 1_000

/** The ledger can exhaust or replace an attempt while its browser work is still open. */
async function executionStillOwned(owner: ExecutionOwnership): Promise<boolean> {
  if (owner.signal?.aborted) return false
  if (owner.taskId) {
    const task = await prisma.auditVerifierExecution.findFirst({
      where: { id: owner.taskId, auditId: owner.auditId, workToken: owner.token,
        workGeneration: owner.generation, workState: 'RUNNING' },
      select: { id: true },
    })
    return task !== null
  }
  const audit = await prisma.audit.findFirst({
    where: { id: owner.auditId, executionToken: owner.token, executionGeneration: owner.generation },
    select: { id: true },
  })
  return audit !== null
}

export async function renewExecution(owner: ExecutionOwnership): Promise<boolean> {
  if (owner.signal?.aborted) return false
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

/** The guard and the write share a transaction. The Site row is a shared fence.
 * The Audit row stays exclusive so status and score updates keep one order. */
async function assertExecutionOwner(tx: Prisma.TransactionClient, owner: ExecutionOwnership): Promise<void> {
  assertExecutionActive(owner)
  // Commands and workers share Project -> Audit -> task lock order. Removal
  // can fence queued work without deadlocking an account reservation.
  // FOR SHARE blocks Site removal without queueing every observation behind
  // one project writer. The task row stays exclusive for its own commit.
  const projects = await tx.$queryRaw<Array<{ id: string; deletedAt: Date | null; lifecycleStatus: string; cleanup: boolean }>>`
    SELECT p."id", p."deletedAt", u."lifecycleStatus", (a."executionSpec"#>>'{scope}'='ACCOUNT_CHECKS' AND a."executionSpec"#>>'{accountChecks,mode}'='cleanup') AS cleanup FROM "projects" p JOIN "users" u ON u.id=p."userId" JOIN "audits" a ON a."projectId" = p."id"
    WHERE a."id" = ${owner.auditId} FOR SHARE OF p
  `
  if (projects.some(project => !project.cleanup && (project.deletedAt || project.lifecycleStatus !== 'ACTIVE'))) throw new ExecutionOwnershipLost()
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
        AND (a."status" != 'COMPLETED' OR e."workKind" IN ('finalize', 'prescription'))
        AND (a."recoveryUntil" IS NULL OR a."recoveryUntil" > clock_timestamp() OR e."workKind" IN ('finalize', 'prescription'))
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

const MAX_TRANSACTION_ATTEMPTS = 5
const RETRIABLE_TRANSACTION_CODES = new Set(['P2028', 'P2034'])
// An interactive timeout already held its locks for the whole budget.
// Repeating that wait piles every other Site write behind it.

type TransactionOptions = { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }

/** A deadlock or lock timeout aborted the statement. The transaction did not commit. */
export function transactionAborted(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''
  // Prisma sometimes reports Postgres 40P01 or 55P03 as a connector error
  // rather than P2034. The statement was cancelled and the transaction aborted.
  if (/40P01|55P03|deadlock detected|lock timeout|Transaction already closed|write conflict or a deadlock/i.test(message)) return true
  return error instanceof Prisma.PrismaClientKnownRequestError && RETRIABLE_TRANSACTION_CODES.has(error.code)
}

function exhaustedTransaction(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''
  return /timeout for this transaction was/i.test(message)
}

/** A write conflict, lock timeout, or expired interactive transaction aborts
 * the attempt. Retry it before the worker discards a finished observation. */
async function runTransaction<T>(write: (tx: Prisma.TransactionClient) => Promise<T>, options?: TransactionOptions): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(write, options)
    } catch (error) {
      if (!transactionAborted(error) || attempt + 1 >= MAX_TRANSACTION_ATTEMPTS || exhaustedTransaction(error) && attempt >= 1) throw error
      const ceiling = Math.min(400, 50 * 2 ** attempt)
      await new Promise(resolve => setTimeout(resolve, ceiling / 2 + Math.random() * ceiling / 2))
    }
  }
}

export async function executionWrite<T>(write: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const owner = ownership.getStore()
  // Commands outside worker execution retain their existing transactional boundary.
  if (!owner) return write(prisma)
  assertExecutionActive(owner)
  return runTransaction(async tx => {
    await assertExecutionOwner(tx, owner)
    assertExecutionActive(owner)
    const result = await write(tx)
    assertExecutionActive(owner)
    return result
  })
}

export async function executionTransaction<T>(
  write: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: TransactionOptions,
): Promise<T> {
  const owner = ownership.getStore()
  assertExecutionActive(owner)
  return runTransaction(async tx => {
    if (owner) await assertExecutionOwner(tx, owner)
    assertExecutionActive(owner)
    const result = await write(tx)
    assertExecutionActive(owner)
    return result
  }, options)
}

export async function withExecutionOwnership<T>(owner: ExecutionOwnership, work: () => Promise<T>): Promise<T> {
  const cancel = new AbortController()
  const inherited = ownership.getStore()?.signal
  const external = owner.signal && inherited && owner.signal !== inherited ? AbortSignal.any([owner.signal, inherited]) : owner.signal ?? inherited
  const signal = external ? AbortSignal.any([cancel.signal, external]) : cancel.signal
  const activeOwner = { ...owner, signal }
  assertExecutionActive(activeOwner)
  let lost = false
  let renewing = false
  let watching = false
  const releaseLost = () => {
    if (lost || signal.aborted) return
    lost = true
    // Close the browser context. An exhausted task must not keep the slot.
    // The reason is read by the deadline listener. Passing the Error here
    // also surfaces it as an unhandled rejection from abort().
    cancel.abort()
  }
  const timer = setInterval(() => {
    if (renewing || lost) return
    renewing = true
    void renewExecution(activeOwner).then(ok => { if (!ok) releaseLost() }).catch(() => undefined).finally(() => { renewing = false })
  }, EXECUTION_LEASE_MS / 3)
  const watch = setInterval(() => {
    if (watching || lost) return
    watching = true
    void executionStillOwned(activeOwner).then(ok => { if (!ok) releaseLost() }).catch(() => undefined).finally(() => { watching = false })
  }, OWNERSHIP_WATCH_MS)
  timer.unref?.()
  watch.unref?.()
  const stopRenewing = () => { clearInterval(timer); clearInterval(watch) }
  signal.addEventListener('abort', stopRenewing, { once: true })
  try {
    return await ownership.run(activeOwner, work)
  } finally {
    stopRenewing()
    signal.removeEventListener('abort', stopRenewing)
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
