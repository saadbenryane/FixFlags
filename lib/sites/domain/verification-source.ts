import type { Prisma } from '@prisma/client'
import type { ExecutionSpec } from './execution-spec'
import { readExecutionSpec } from './execution-spec'
import { repairSourceSelect } from './repair-source'

/** A grouped repair reads its frozen original captures. Historical requests
 * retain the named source Audit and detector, never the current incident. */
export function diagnosticSourceWhere(spec: ExecutionSpec | null, projectId: string | null): Prisma.FlagWhereInput {
  const target = spec?.verificationTarget
  if (target?.kind !== 'DIAGNOSTIC' || !projectId) return { id: { in: [] } }
  return { audit: { projectId }, ...(spec?.verificationSourceFlagIds
    ? { id: { in: spec.verificationSourceFlagIds } }
    : { auditId: target.parentAuditId, checkId: target.checkId }) }
}

/** Every collector reads the same declaration facts. Live membership remains
 * required; retaining comparison facts cannot authorize another Site's data. */
export async function readDiagnosticSources(db: Pick<Prisma.TransactionClient, 'flag'>,
  spec: ExecutionSpec | null, projectId: string | null) {
  const where = diagnosticSourceWhere(spec, projectId)
  if (!spec?.verificationSources) return db.flag.findMany({ where,
    take: spec?.verificationSourceFlagIds?.length ?? 100, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: repairSourceSelect })
  const live = await db.flag.findMany({ where, take: spec.verificationSources.flags.length, select: { id: true, auditId: true } })
  const owned = new Map(live.map(flag => [flag.id, flag.auditId]))
  if (spec.verificationSources.flags.some(flag => owned.get(flag.id) !== flag.auditId))
    throw new Error('The recorded repair source is no longer available')
  return spec.verificationSources.flags
}

/** Locate the immutable source receipt for this page without borrowing a later
 * observation. Multiple captures on the same page retain their own Flag rules. */
export async function verificationSourceAuditId(db: Pick<Prisma.TransactionClient, 'flag'>,
  audit: { parentId: string | null; projectId?: string | null; executionSpec?: unknown }, pageUrl: string) {
  const spec = readExecutionSpec(audit.executionSpec)
  if (!spec?.verificationSourceFlagIds) return audit.parentId
  if (!audit.projectId) return null
  const sources = await readDiagnosticSources(db, spec, audit.projectId)
  const source = sources.find(flag => flag.pageUrl === pageUrl || Array.isArray(flag.affectedPaths) && flag.affectedPaths.includes(pageUrl))
  return source?.auditId ?? null
}
