import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { hasRecordedRecoveryEvidence, type RecoveryFlag } from '@/lib/audit/recovery-evidence'
import { siteAnalysisAuditWhere } from './analysis-scope'

export function unboundSiteFindingWhere(projects: string | string[]): Prisma.FlagWhereInput {
  return { audit: { projectId: typeof projects === 'string' ? projects : { in: projects }, ...siteAnalysisAuditWhere },
    improvementOccurrence: null, status: { in: ['OPEN', 'REGRESSED', 'FIXED'] } }
}

/** Workflow completion alone cannot hide unresolved or unproven occurrences. */
export const currentImprovementWhere = { OR: [
  { status: { in: ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'READY_TO_VERIFY', 'UNVERIFIED'] } },
  { status: 'VERIFIED', occurrences: { some: { flag: { status: { in: ['OPEN', 'REGRESSED', 'FIXED'] } } } } },
] } satisfies Prisma.ImprovementWhereInput

/** Batch recovery provenance once for the authorized projects. A pointer to
 * another tenant's completed Audit cannot clear this project's incident. */
export async function loadIncidentRecoveryProofs(groups: Array<{ projectId: string;
  flags: Array<RecoveryFlag & { id?: string; status?: string | null; resolvedInId?: string | null }> }>) {
  const ids = [...new Set(groups.flatMap(group => group.flags.flatMap(flag =>
    flag.status === 'FIXED' && flag.resolvedInId ? [flag.resolvedInId] : [])))]
  type Proofs = Map<string, Date> & { hasFlag: (flag: { id?: string; resolvedInId?: string | null }) => boolean }
  const byProject = new Map<string, Proofs>()
  const provenFlagsByProject = new Map<string, Set<string>>()
  if (!ids.length) return byProject
  const audits = await prisma.audit.findMany({ where: { id: { in: ids }, projectId: { in: [...new Set(groups.map(group => group.projectId))] },
    status: 'COMPLETED', completedAt: { not: null } }, select: { id: true, projectId: true, completedAt: true, executionSpec: true,
      verifierExecutions: { where: { status: 'COMPLETED', OR: [{ targetKey: { startsWith: 'module:' } }, { targetKey: { startsWith: 'check:' } }] },
        select: { targetKey: true, status: true, detail: true } } } })
  for (const audit of audits) if (audit.projectId && audit.completedAt) {
    const matched = groups.filter(group => group.projectId === audit.projectId).flatMap(group => group.flags)
      .filter(flag => flag.id && flag.status === 'FIXED' && flag.resolvedInId === audit.id && hasRecordedRecoveryEvidence({
        auditId: audit.id, executionSpec: audit.executionSpec, flag, executions: audit.verifierExecutions ?? [],
      }))
    if (!matched.length) continue
    const keys = provenFlagsByProject.get(audit.projectId) ?? new Set<string>()
    for (const flag of matched) keys.add(`${flag.id}:${audit.id}`)
    provenFlagsByProject.set(audit.projectId, keys)
    const proofs: Proofs = byProject.get(audit.projectId) ?? Object.assign(new Map<string, Date>(), {
      hasFlag: (flag: { id?: string; resolvedInId?: string | null }) => keys.has(`${flag.id}:${flag.resolvedInId}`),
    })
    proofs.set(audit.id, audit.completedAt)
    byProject.set(audit.projectId, proofs)
  }
  return byProject
}
