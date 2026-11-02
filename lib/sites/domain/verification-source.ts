import type { Prisma } from '@prisma/client'
import type { ExecutionSpec } from './execution-spec'
import { readExecutionSpec } from './execution-spec'

/** A grouped repair reads its frozen original captures. Historical requests
 * retain the named source Audit and detector, never the current incident. */
export function diagnosticSourceWhere(spec: ExecutionSpec | null, projectId: string | null): Prisma.FlagWhereInput {
  const target = spec?.verificationTarget
  if (target?.kind !== 'DIAGNOSTIC' || !projectId) return { id: { in: [] } }
  return { audit: { projectId }, ...(spec?.verificationSourceFlagIds
    ? { id: { in: spec.verificationSourceFlagIds } }
    : { auditId: target.parentAuditId, checkId: target.checkId }) }
}

/** Locate the immutable source receipt for this page without borrowing a later
 * observation. Multiple captures on the same page retain their own Flag rules. */
export async function verificationSourceAuditId(db: Pick<Prisma.TransactionClient, 'flag'>,
  audit: { parentId: string | null; projectId?: string | null; executionSpec?: unknown }, pageUrl: string) {
  const spec = readExecutionSpec(audit.executionSpec)
  if (!spec?.verificationSourceFlagIds) return audit.parentId
  if (!audit.projectId) return null
  const source = await db.flag.findFirst({ where: { ...diagnosticSourceWhere(spec, audit.projectId),
    OR: [{ pageUrl }, { affectedPaths: { array_contains: [pageUrl] } }] },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { auditId: true } })
  return source?.auditId ?? null
}
