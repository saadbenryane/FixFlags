import { prisma } from '@/lib/db'

/** Batch recovery provenance once for the authorized projects. A pointer to
 * another tenant's completed Audit cannot clear this project's incident. */
export async function loadIncidentRecoveryProofs(groups: Array<{ projectId: string;
  flags: Array<{ status?: string | null; resolvedInId?: string | null }> }>) {
  const ids = [...new Set(groups.flatMap(group => group.flags.flatMap(flag =>
    flag.status === 'FIXED' && flag.resolvedInId ? [flag.resolvedInId] : [])))]
  const byProject = new Map<string, Map<string, Date>>()
  if (!ids.length) return byProject
  const audits = await prisma.audit.findMany({ where: { id: { in: ids }, projectId: { in: [...new Set(groups.map(group => group.projectId))] },
    status: 'COMPLETED', completedAt: { not: null } }, select: { id: true, projectId: true, completedAt: true } })
  for (const audit of audits) if (audit.projectId && audit.completedAt) {
    const proofs = byProject.get(audit.projectId) ?? new Map<string, Date>()
    proofs.set(audit.id, audit.completedAt); byProject.set(audit.projectId, proofs)
  }
  return byProject
}
