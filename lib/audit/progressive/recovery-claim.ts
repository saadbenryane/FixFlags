import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

const progressive = Prisma.sql`a."executionSpec"->>'engine' = 'progressive-v1'`
const tasks = Prisma.sql`SELECT 1 FROM audit_execution_tasks t WHERE t."auditId" = a.id`
const unfinished = Prisma.sql`t."workState" NOT IN ('COMPLETED', 'BLOCKED', 'EXHAUSTED')`
const RECOVERY_RECHECK_MS = 10_000

type RecoveryKind = 'coordinator' | 'graph'
function recoveryEligibility(kind: RecoveryKind, dueAt: Date) {
  return kind === 'coordinator' ? Prisma.sql`
    a.status NOT IN ('COMPLETED', 'FAILED') AND ${progressive}
    AND (a.status <> 'QUEUED' OR a."createdAt" <= ${new Date(dueAt.getTime() - RECOVERY_RECHECK_MS)})
    AND (a."executionLeaseUntil" IS NULL OR a."executionLeaseUntil" <= ${dueAt})
    AND NOT EXISTS (${tasks})` : Prisma.sql`
    a.status <> 'FAILED' AND a."startedAt" IS NOT NULL
    AND ((${progressive} AND (
      (a.status <> 'COMPLETED' AND EXISTS (${tasks})) OR
      EXISTS (${tasks} AND t."workKind" = 'finalize' AND ${unfinished})
    )) OR EXISTS (${tasks} AND t."workKind" = 'prescription' AND ${unfinished}))`
}

/** Skip busy Audits before applying the bound. The claim rechecks eligibility
 * and yields if a lock arrives after this short selection. */
export function selectProgressiveRecovery(kind: RecoveryKind, dueAt: Date, limit: number) {
  return prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT a.id FROM audits a
    WHERE a."dispatchNextAt" <= ${dueAt} AND (${recoveryEligibility(kind, dueAt)})
    ORDER BY a."dispatchNextAt", a.id LIMIT ${Math.min(100, Math.max(1, limit))}
    FOR NO KEY UPDATE OF a SKIP LOCKED`)
}

export async function claimProgressiveRecovery(kind: RecoveryKind, dueAt: Date, auditId: string) {
  const now = new Date()
  return prisma.$executeRaw(Prisma.sql`
    UPDATE audits SET "dispatchNextAt" = ${new Date(now.getTime() + RECOVERY_RECHECK_MS)}, "updatedAt" = ${now}
    WHERE id IN (
      SELECT a.id FROM audits a WHERE a.id = ${auditId}
        AND a."dispatchNextAt" <= ${dueAt} AND (${recoveryEligibility(kind, dueAt)})
      FOR NO KEY UPDATE OF a SKIP LOCKED
    )`)
}
