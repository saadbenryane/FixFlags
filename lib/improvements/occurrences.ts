import { isCustomerFlag,isResolvedFlagStatus } from '@/lib/audit/attention'
import { executionTransaction } from '@/lib/audit/execution-ownership'
import { flagFingerprint } from '@/lib/audit/flag-identity'
import { rankFlagsByPriority } from '@/lib/audit/priority-flags'
import { prisma } from '@/lib/db'
import { appendImprovementCycleEvent } from '@/lib/improvements/cycle-ledger'
import { adoptLegacyOutcomeIdentity } from '@/lib/sites/application/outcome-identity'
import type { ImprovementOccurrenceKind } from '@prisma/client'

import type { ImprovementFlag } from './service-types'
import { lockImprovementLedger } from './ledger-lock'

function proposalData(flag: ImprovementFlag, priority: number) {
  return {
    title: flag.problem, judgment: flag.whyItMatters || flag.problem,
    expectedBenefit: flag.whyItMatters || 'Remove the observed product friction.',
    recommendedChange: flag.fix, protectedScope: flag.pageUrl,
    successCondition: flag.verificationRule || 'Recovery criteria have not been established.', priority,
  }
}

export function improvementFingerprint(input: {
  checkId: string | null
  problem: string
  rubric: string
  fingerprint?: string | null
}): string {
  return flagFingerprint(input)
}

export function occurrenceKind(status: string): ImprovementOccurrenceKind {
  if (status === 'REGRESSED') return 'REGRESSED'
  if (status === 'FIXED') return 'CLEARED'
  return 'OBSERVED'
}

/**
 * Persist every actionable Site Flag. The bounded handoff plan does not limit Site memory.
 */
export async function materializeAttentionForAudit(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: {
      id: true,
      userId: true,
      projectId: true,
      executionSpec: true,
      url: true,
      productContract: true,
      flags: true,
      rubrics: { select: { name: true, grade: true } },
    },
  })
  if (!audit?.userId || !audit.projectId) return
  const projectId = audit.projectId

  const flags = audit.flags as ImprovementFlag[]
  const customerFlags = flags.filter(isCustomerFlag)
  const recommendations = flags.filter(flag => !isResolvedFlagStatus(flag.status) && !isCustomerFlag(flag))
  // Once an owner acts on a recommendation, that Improvement owns subsequent
  // observations too. Keep its priority and the existing Attention policy.
  const existingRecommendations = recommendations.length ? await prisma.improvement.findMany({
    where: { projectId, fingerprint: { in: [...new Set(recommendations.map(improvementFingerprint))] } },
    select: { fingerprint: true, priority: true },
  }) : []
  const recommendationPriorities = new Map(existingRecommendations.map(item => [item.fingerprint, item.priority]))
  const candidates = rankFlagsByPriority(customerFlags, [], customerFlags.length)
    .map(({ flag }) => flag).concat(recommendations.filter(flag => recommendationPriorities.has(improvementFingerprint(flag))))

  const observationsByFingerprint = new Map<string, ImprovementFlag[]>()
  for (const flag of flags) {
    const fingerprint = improvementFingerprint(flag)
    const observations = observationsByFingerprint.get(fingerprint) ?? []
    observations.push(flag)
    observationsByFingerprint.set(fingerprint, observations)
  }
  const projected = new Set<string>()
  let uniquePriority = 0
  for (const flag of candidates) {
    const fingerprint = improvementFingerprint(flag)
    if (projected.has(fingerprint)) continue
    projected.add(fingerprint)
    const priority = isCustomerFlag(flag) ? uniquePriority++ : recommendationPriorities.get(fingerprint)!
    await executionTransaction(async tx => {
      await adoptLegacyOutcomeIdentity(tx, { projectId, fingerprint, executionSpec: audit.executionSpec })
      // Initialize identity without changing an existing row before its ledger
      // lock. An upsert here would take its row lock ahead of verification.
      const initialized = await tx.improvement.createMany({ data: { projectId, fingerprint, ...proposalData(flag, priority) }, skipDuplicates: true })
      const identity = await tx.improvement.findUniqueOrThrow({
        where: { projectId_fingerprint: { projectId, fingerprint } },
        select: { id: true },
      })
      await lockImprovementLedger(tx, identity.id)
      const observations = (await tx.flag.findMany({ where: { auditId,
        id: { in: observationsByFingerprint.get(fingerprint)!.map(observation => observation.id) },
        audit: { projectId, userId: audit.userId } } }))
        .filter(observation => improvementFingerprint(observation) === fingerprint)
      const customer = rankFlagsByPriority(observations.filter(isCustomerFlag), [], observations.length)[0]?.flag
      const current = customer ?? (recommendationPriorities.has(fingerprint)
        ? observations.find(observation => !isResolvedFlagStatus(observation.status) && !isCustomerFlag(observation)) : undefined)
      if (!current) {
        // A new provisional identity is still private to this transaction and
        // has no references. Do not retain it when its observation disappeared.
        if (initialized.count) await tx.improvement.delete({ where: { id: identity.id } })
        return
      }
      const improvement = await tx.improvement.update({ where: { id: identity.id }, data: proposalData(current, priority) })
      if (improvement.status === 'VERIFIED') await tx.improvement.update({
        where: { id: improvement.id },
        data: { status: 'PROPOSED' },
      })
      for (const observedFlag of observations) {
        const occurrence = await tx.improvementOccurrence.upsert({
          where: { flagId: observedFlag.id },
          create: {
            improvementId: improvement.id,
            auditId,
            flagId: observedFlag.id,
            kind: occurrenceKind(observedFlag.status),
          },
          update: {
            improvementId: improvement.id,
            auditId,
            kind: occurrenceKind(observedFlag.status),
          },
        })
        await appendImprovementCycleEvent({
          projectId,
          improvementId: improvement.id,
          occurrenceId: occurrence.id,
          sourceAuditId: auditId,
          idempotencyKey: `generated:${observedFlag.id}`,
          type: 'GENERATED',
          transport: 'SYSTEM',
        }, tx)
      }
    })
  }
}
