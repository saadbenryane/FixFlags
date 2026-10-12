import { isCustomerFlag,isResolvedFlagStatus } from '@/lib/audit/attention'
import { executionWrite } from '@/lib/audit/execution-ownership'
import { flagFingerprint } from '@/lib/audit/flag-identity'
import { rankFlagsByPriority } from '@/lib/audit/priority-flags'
import { prisma } from '@/lib/db'
import { appendImprovementCycleEvent } from '@/lib/improvements/cycle-ledger'
import { adoptLegacyOutcomeIdentity } from '@/lib/sites/application/outcome-identity'
import type {
ImprovementOccurrenceKind,
ImprovementStatus
} from '@prisma/client'

import type { ImprovementFlag } from './service-types'

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

  const improvementsByFingerprint = new Map<string, { id: string; status: ImprovementStatus }>()
  let uniquePriority = 0
  for (const flag of candidates) {
    const fingerprint = improvementFingerprint(flag)
    let improvement = improvementsByFingerprint.get(fingerprint)
    if (!improvement) {
      const priority = isCustomerFlag(flag) ? uniquePriority++ : recommendationPriorities.get(fingerprint)!
      improvement = await executionWrite(async tx => {
        await adoptLegacyOutcomeIdentity(tx, { projectId, fingerprint, executionSpec: audit.executionSpec })
        return tx.improvement.upsert({
        where: { projectId_fingerprint: { projectId, fingerprint } },
        create: {
          projectId,
          fingerprint,
          title: flag.problem,
          judgment: flag.whyItMatters || flag.problem,
          expectedBenefit: flag.whyItMatters || 'Remove the observed product friction.',
          recommendedChange: flag.fix,
          protectedScope: flag.pageUrl,
          successCondition:
            flag.verificationRule || 'Recovery criteria have not been established.',
          priority,
        },
        update: {
          title: flag.problem,
          judgment: flag.whyItMatters || flag.problem,
          expectedBenefit: flag.whyItMatters || 'Remove the observed product friction.',
          recommendedChange: flag.fix,
          protectedScope: flag.pageUrl,
          successCondition:
            flag.verificationRule || 'Recovery criteria have not been established.',
          priority,
        },
      }) })
      improvementsByFingerprint.set(fingerprint, improvement)
    }
    if (improvement.status === 'VERIFIED') {
      await executionWrite(tx => tx.improvement.update({
        where: { id: improvement.id },
        data: { status: 'PROPOSED' },
      }))
    }
    const observedFlags = flags.filter(
      (candidate) => improvementFingerprint(candidate) === fingerprint
    )
    for (const observedFlag of observedFlags) {
      const occurrence = await executionWrite(tx => tx.improvementOccurrence.upsert({
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
      }))
      await appendImprovementCycleEvent({
        projectId: audit.projectId,
        improvementId: improvement.id,
        occurrenceId: occurrence.id,
        sourceAuditId: auditId,
        idempotencyKey: `generated:${observedFlag.id}`,
        type: 'GENERATED',
        transport: 'SYSTEM',
      })
    }
  }
}
