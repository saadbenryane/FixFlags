import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { auditDeadlineMsForDepth } from '@/lib/audit/review-depth'
import { expiredAnalysisRecoveryWhere } from '@/lib/audit/progressive/recovery-window'

/** Queue admission cannot exempt never-started work from its execution window.
 * Progressive recovery and the legacy executor retain their different budgets. */
function overdueExecutionWhere(now: Date): Prisma.AuditWhereInput {
  const progressive = { executionSpec: { path: ['engine'], equals: 'progressive-v1' } }
  return { status: { notIn: ['COMPLETED', 'FAILED'] }, OR: [
    { ...progressive, ...expiredAnalysisRecoveryWhere(now) },
    { AND: [{ OR: [
      { executionSpec: { path: ['engine'], equals: Prisma.AnyNull } },
      { NOT: progressive },
    ] }], OR: ([1, 2, 3] as const).map(depth => {
      const before = new Date(now.getTime() - auditDeadlineMsForDepth(depth))
      return { reviewDepth: depth, OR: [{ startedAt: { lt: before } }, { startedAt: null, createdAt: { lt: before } }] }
    }) },
  ] }
}

/** A consistent diagnostic snapshot is bounded independently of recovery.
 * It reads evidence and never settles, retries or modifies an execution. */
export function readExecutionHealth(now: Date) {
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '500ms'")
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '250ms'")
    const [oldest, overdueAuditCount] = await Promise.all([
      tx.audit.findFirst({ where: { status: { notIn: ['COMPLETED', 'FAILED'] } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { status: true, createdAt: true, startedAt: true } }),
      tx.audit.count({ where: overdueExecutionWhere(now) }),
    ])
    return { overdueAuditCount, oldestAudit: oldest ? { status: oldest.status,
      ageSeconds: Math.round((now.getTime() - oldest.createdAt.getTime()) / 1000), startedAt: oldest.startedAt } : null }
  }, { maxWait: 500, timeout: 3000, isolationLevel: 'RepeatableRead' })
}
