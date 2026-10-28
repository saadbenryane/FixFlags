import type { Prisma } from '@prisma/client'
import { parseProductContract } from '@/lib/audit/product-contract'
import { appendGeneratedImprovementCycleEvents } from './cycle-ledger'
import { improvementFingerprint, occurrenceKind } from './occurrences'
import { repairGuidanceText } from './repair-guidance'

export const ownedFlagIdentityInclude = {
  improvementOccurrence: { select: { id: true, improvementId: true } },
  audit: { select: { id: true, projectId: true, productContract: true } },
} satisfies Prisma.FlagInclude

type IdentityFlag = Prisma.FlagGetPayload<{ include: typeof ownedFlagIdentityInclude }>
type Identity = { id: string; improvementId: string }
type IdentityActor = { userId: string; transport: string; client?: string; actor?: string }

function identityData(flag: IdentityFlag, projectId: string): Prisma.ImprovementCreateManyInput {
  const contract = parseProductContract(flag.audit.productContract)
  return {
    projectId,
    fingerprint: improvementFingerprint(flag),
    title: flag.problem,
    judgment: flag.whyItMatters,
    expectedBenefit: flag.whyItMatters,
    recommendedChange: repairGuidanceText(flag),
    protectedScope: contract?.criticalOutcomes.length
      ? 'Keep these Product outcomes unchanged: ' + contract.criticalOutcomes.join('; ') : null,
    successCondition: flag.verificationRule || 'A fresh Product Review no longer observes: ' + flag.problem,
    priority: 50,
    status: 'PROPOSED',
  }
}

/** Claim and repair commands share one owned identity writer, without recording a repair. */
export async function ensureOwnedFlagIdentities(
  tx: Prisma.TransactionClient,
  inputFlags: IdentityFlag[],
  input: IdentityActor,
) {
  const flags = [...new Map(inputFlags.map(flag => [flag.id, flag])).values()]
  const identities = new Map<string, Identity>()
  if (!flags.length) return identities
  const projectId = flags[0].audit.projectId
  if (!projectId || flags.some(flag => flag.audit.projectId !== projectId)) {
    throw new Error('Flag is not attached to an owned Product')
  }
  const authority = { userId: input.userId, projectId, project: { userId: input.userId, deletedAt: null } }
  const owned = flags.length === 1
    ? await tx.flag.findFirst({ where: { id: flags[0].id, audit: authority }, select: { id: true } }).then(row => row ? [row] : [])
    : await tx.flag.findMany({ where: { id: { in: flags.map(flag => flag.id) }, audit: authority }, select: { id: true } })
  if (owned.length !== flags.length) throw new Error('Flag is not attached to an owned Product')
  for (const flag of flags) {
    if (flag.improvementOccurrence) identities.set(flag.id, flag.improvementOccurrence)
  }
  const missing = flags.filter(flag => !flag.improvementOccurrence)
  // Batch writes keep a large claimed analysis within the existing transaction
  // budget. Existing proposals and historical event metadata are never replaced.
  for (let offset = 0; offset < missing.length; offset += 500) {
    const batch = missing.slice(offset, offset + 500)
    const proposals = [...new Map(batch.map(flag => [improvementFingerprint(flag), identityData(flag, projectId)])).values()]
    await tx.improvement.createMany({ data: proposals, skipDuplicates: true })
    const saved = await tx.improvement.findMany({
      where: { projectId, fingerprint: { in: proposals.map(row => row.fingerprint) } },
      select: { id: true, fingerprint: true },
    })
    const byFingerprint = new Map(saved.map(row => [row.fingerprint, row.id]))
    const occurrences = batch.map(flag => {
      const improvementId = byFingerprint.get(improvementFingerprint(flag))
      if (!improvementId) throw new Error('Owned Flag identity was not published')
      return { improvementId, auditId: flag.audit.id, flagId: flag.id, kind: occurrenceKind(flag.status) }
    })
    await tx.improvementOccurrence.createMany({ data: occurrences, skipDuplicates: true })
    const linked = await tx.improvementOccurrence.findMany({
      where: { flagId: { in: batch.map(flag => flag.id) } },
      select: { id: true, flagId: true, auditId: true, improvementId: true },
    })
    if (linked.length !== batch.length) throw new Error('Owned Flag observations were not published')
    await appendGeneratedImprovementCycleEvents(linked.map(row => ({
      projectId,
      improvementId: row.improvementId,
      occurrenceId: row.id,
      sourceAuditId: row.auditId,
      idempotencyKey: 'generated:' + row.flagId,
      transport: input.transport,
      client: input.client,
      actor: input.actor,
    })), tx)
    for (const row of linked) identities.set(row.flagId, row)
  }
  return identities
}

export async function ensureOwnedFlagIdentity(tx: Prisma.TransactionClient, flag: IdentityFlag, input: IdentityActor) {
  const identity = (await ensureOwnedFlagIdentities(tx, [flag], input)).get(flag.id)
  if (!identity) throw new Error('Owned Flag identity was not published')
  return identity
}
