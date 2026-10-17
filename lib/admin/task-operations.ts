import type { Prisma } from '@prisma/client'

/** History retains failed execution facts after later checks. It does not
 * classify every historical failure as an unresolved current condition. */
export function incompleteExecutionHistory(): Prisma.AuditVerifierExecutionWhereInput {
  return {
    workState: { in: ['BLOCKED', 'EXHAUSTED'] },
    status: { not: 'NOT_APPLICABLE' },
    audit: { project: { deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } } },
  }
}
