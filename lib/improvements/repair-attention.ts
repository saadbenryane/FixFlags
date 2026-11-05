import type { FlagStatus, Prisma } from '@prisma/client'
import { incidentRecoveryFlagSelect, loadIncidentRecoveryProofs } from '@/lib/sites/application/incident-proofs'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'

/** The command already owns the active actor, Site and improvement ledger.
 * A fresh declaration supersedes dismissal only for its selected sources. */
export async function reactivateRepairSources(tx: Prisma.TransactionClient, input: {
  projectId: string; improvementId: string; flagIds: string[];
}) {
  if (!input.flagIds.length) return
  const ignored = await tx.flag.findMany({ where: { id: { in: input.flagIds }, status: 'IGNORED', audit: { projectId: input.projectId },
    improvementOccurrence: { improvementId: input.improvementId, audit: { projectId: input.projectId }, improvement: { projectId: input.projectId } },
  }, select: { ...incidentRecoveryFlagSelect, improvementOccurrence: { select: { kind: true } } } })
  if (!ignored.length) return
  // A previous genuine recovery remains genuine. Dismissal alone cannot prove
  // one, and a repair declaration cannot invent a new observed regression.
  const proofs = (await loadIncidentRecoveryProofs([{ projectId: input.projectId,
    flags: ignored.map(flag => ({ ...flag, status: 'FIXED' })) }], tx)).get(input.projectId)
  const groups = new Map<FlagStatus, string[]>()
  for (const flag of ignored) {
    const status = proofs?.hasFlag(flag) ? 'FIXED' : flag.improvementOccurrence?.kind === 'REGRESSED' ? 'REGRESSED' : 'OPEN'
    const ids = groups.get(status) ?? []
    ids.push(flag.id); groups.set(status, ids)
  }
  for (const [status, ids] of groups) {
    const changed = await tx.flag.updateMany({ where: { id: { in: ids }, status: 'IGNORED', audit: { projectId: input.projectId },
      improvementOccurrence: { improvementId: input.improvementId } }, data: { status } })
    if (changed.count !== ids.length) throw new SiteRunRefusal('The repair source changed. Prepare the fix again.', 409, 'REPAIR_CONTEXT_CHANGED')
  }
}
