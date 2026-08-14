import type {
  ImprovementOccurrenceKind,
  ImprovementStatus,
  Prisma,
  VerificationOutcome,
} from '@prisma/client'
import { prisma } from '@/lib/db'
import { buildUnifiedPlanBundle } from '@/lib/audit/load-finish-plan-flags'
import { flagFingerprint } from '@/lib/audit/flag-identity'
import { parseProductContract } from '@/lib/audit/product-contract'
import {
  appendVerifiedLearning,
  productIntelligenceFromContract,
} from '@/lib/audit/product-intelligence'
import { mutateProjectIntelligence } from '@/lib/audit/ensure-product-project'
import { synthesizeProductSignals } from '@/lib/signals/judgment'
import { assessVerificationCoverage } from '@/lib/improvements/verification-coverage'
import type { ImprovementRejectionReason } from '@/lib/improvements/rejection-reasons'
import { appendImprovementCycleEvent } from '@/lib/improvements/cycle-ledger'

type ImprovementFlag = {
  id: string
  checkId: string | null
  rubric: string
  severity: string
  impactTag: string | null
  problem: string
  evidence: string
  whyItMatters: string
  fix: string
  agentPrompt: string | null
  cursorPrompt: string | null
  claudePrompt: string | null
  windsurfPrompt: string | null
  lovablePrompt: string | null
  boltPrompt: string | null
  verificationRule: string | null
  pageUrl: string | null
  confidence: number
  source: string
  status: string
  fingerprint?: string | null
}

export function improvementFingerprint(input: {
  checkId: string | null
  problem: string
  rubric: string
  fingerprint?: string | null
}): string {
  if (!input.checkId && input.fingerprint?.trim()) return `ai:${input.fingerprint.trim()}`
  return flagFingerprint(input)
}

function occurrenceKind(status: string): ImprovementOccurrenceKind {
  if (status === 'REGRESSED') return 'REGRESSED'
  if (status === 'FIXED') return 'CLEARED'
  return 'OBSERVED'
}

/**
 * Lazily creates durable Improvements only for claimed Products and only from
 * the bounded, worthwhile portion of the canonical Finish Plan.
 */
export async function materializeAttentionForAudit(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: {
      id: true,
      userId: true,
      projectId: true,
      url: true,
      productContract: true,
      flags: true,
      rubrics: { select: { name: true, grade: true } },
    },
  })
  if (!audit?.userId || !audit.projectId) return

  const flags = audit.flags as ImprovementFlag[]
  const byId = new Map(flags.map((flag) => [flag.id, flag]))
  const contract = parseProductContract(audit.productContract)
  const { finishPlan } = await buildUnifiedPlanBundle({
    userId: audit.userId,
    auditUrl: audit.url,
    flags,
    rubricRows: audit.rubrics.map((rubric) => ({
      name: rubric.name,
      grade: rubric.grade,
    })),
    contract,
    promptAccess: 'all',
  })

  const improvementsByFingerprint = new Map<string, { id: string; status: ImprovementStatus }>()
  let uniquePriority = 0
  for (const item of finishPlan.items) {
    const flag = byId.get(item.id)
    if (!flag) continue
    const fingerprint = improvementFingerprint(flag)
    let improvement = improvementsByFingerprint.get(fingerprint)
    if (!improvement) {
      if (uniquePriority >= 3) continue
      improvement = await prisma.improvement.upsert({
        where: { projectId_fingerprint: { projectId: audit.projectId, fingerprint } },
        create: {
          projectId: audit.projectId,
          fingerprint,
          title: item.problem,
          judgment: item.whyItMatters || item.problem,
          expectedBenefit: item.whyItMatters || 'Remove the observed product friction.',
          recommendedChange: item.recommendedChange,
          protectedScope: item.protectedScope,
          successCondition:
            item.verificationRule || `A fresh Product Review no longer observes: ${item.problem}`,
          priority: 100 - uniquePriority,
        },
        update: {
          title: item.problem,
          judgment: item.whyItMatters || item.problem,
          expectedBenefit: item.whyItMatters || 'Remove the observed product friction.',
          recommendedChange: item.recommendedChange,
          protectedScope: item.protectedScope,
          successCondition:
            item.verificationRule || `A fresh Product Review no longer observes: ${item.problem}`,
          priority: 100 - uniquePriority,
        },
      })
      improvementsByFingerprint.set(fingerprint, improvement)
      uniquePriority += 1
    }
    if (improvement.status === 'VERIFIED') {
      await prisma.improvement.update({
        where: { id: improvement.id },
        data: { status: 'PROPOSED' },
      })
    }
    const observedFlags = flags.filter(
      (candidate) => improvementFingerprint(candidate) === fingerprint
    )
    for (const observedFlag of observedFlags) {
      const occurrence = await prisma.improvementOccurrence.upsert({
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

export async function createImprovementAttempt(input: {
  improvementId: string
  projectId: string
  userId: string
  sourceAuditId: string
  builder: string
  client?: string
  actor?: string
  handoffReference?: string
  pullRequestReference?: string
  deploymentReference?: string
  changeSummary: string
}) {
  const changeSummary = input.changeSummary.trim()
  if (!changeSummary) throw new Error('Describe the implemented change before verification')
  const improvement = await prisma.improvement.findFirst({
    where: {
      id: input.improvementId,
      projectId: input.projectId,
      project: { userId: input.userId },
      occurrences: { some: { auditId: input.sourceAuditId } },
    },
    select: { id: true },
  })
  if (!improvement) throw new Error('Improvement not found for Product')

  return prisma.$transaction(async (tx) => {
    const accepted = await tx.improvement.updateMany({
      where: { id: improvement.id, acceptedAt: null },
      data: { acceptedAt: new Date(), acceptedByChannel: input.builder },
    })
    const existing = await tx.improvementAttempt.findFirst({
      where: {
        improvementId: improvement.id,
        sourceAuditId: input.sourceAuditId,
        outcome: null,
      },
      select: { id: true },
    })
    const data = {
      builder: input.builder,
      handoffReference: input.handoffReference,
      pullRequestReference: input.pullRequestReference,
      deploymentReference: input.deploymentReference,
      changeSummary,
    }
    const attempt = existing
      ? await tx.improvementAttempt.update({ where: { id: existing.id }, data })
      : await tx.improvementAttempt.create({
          data: {
            improvementId: improvement.id,
            sourceAuditId: input.sourceAuditId,
            ...data,
          },
        })
    await tx.improvement.update({
      where: { id: improvement.id },
      data: { status: 'READY_TO_VERIFY' },
    })
    if (accepted.count > 0) {
      await appendImprovementCycleEvent({
        projectId: input.projectId,
        improvementId: improvement.id,
        sourceAuditId: input.sourceAuditId,
        idempotencyKey: `accepted-ready-to-verify:${attempt.id}`,
        type: 'ACCEPTED_EXPLICIT',
        transport: input.builder,
        client: input.client,
        actor: input.actor,
        attemptId: attempt.id,
      }, tx)
    }
    await appendImprovementCycleEvent({
      projectId: input.projectId,
      improvementId: improvement.id,
      sourceAuditId: input.sourceAuditId,
      idempotencyKey: `attempted:${attempt.id}`,
      type: 'ATTEMPTED',
      transport: input.builder,
      client: input.client,
      actor: input.actor,
      attemptId: attempt.id,
    }, tx)
    return attempt
  })
}

export async function recordFlagImprovementAttempt(input: {
  flagId: string
  userId: string
  builder: string
  client?: string
  actor?: string
  action: 'ACCEPT' | 'HANDOFF_COPIED' | 'READY_TO_VERIFY' | 'REJECT'
  changeSummary?: string
  deploymentReference?: string
  rejectionReason?: ImprovementRejectionReason
  rejectionNote?: string
  rejectionRevisitAt?: Date
  contextCorrection?: Prisma.InputJsonValue
}) {
  const flag = await prisma.flag.findFirst({
    where: { id: input.flagId, audit: { userId: input.userId } },
    include: {
      improvementOccurrence: { select: { id: true, improvementId: true } },
      audit: { select: { id: true, projectId: true, productContract: true } },
    },
  })
  if (!flag?.audit.projectId) throw new Error('Flag is not attached to an owned Product')

  let improvementId = flag.improvementOccurrence?.improvementId
  if (!improvementId) {
    const contract = parseProductContract(flag.audit.productContract)
    const fingerprint = improvementFingerprint(flag)
    const improvement = await prisma.improvement.upsert({
      where: {
        projectId_fingerprint: { projectId: flag.audit.projectId, fingerprint },
      },
      create: {
        projectId: flag.audit.projectId,
        fingerprint,
        title: flag.problem,
        judgment: flag.whyItMatters,
        expectedBenefit: flag.whyItMatters,
        recommendedChange: flag.fix,
        protectedScope: contract?.criticalOutcomes.length
          ? `Keep these Product outcomes unchanged: ${contract.criticalOutcomes.join('; ')}`
          : null,
        successCondition:
          flag.verificationRule || `A fresh Product Review no longer observes: ${flag.problem}`,
        priority: 50,
        status: 'PROPOSED',
      },
      update: {},
      select: { id: true },
    })
    improvementId = improvement.id
    const occurrence = await prisma.improvementOccurrence.upsert({
      where: { flagId: flag.id },
      create: {
        improvementId,
        auditId: flag.audit.id,
        flagId: flag.id,
        kind: 'OBSERVED',
      },
      update: {},
    })
    await appendImprovementCycleEvent({
      projectId: flag.audit.projectId,
      improvementId,
      occurrenceId: occurrence.id,
      sourceAuditId: flag.audit.id,
      idempotencyKey: `generated:${flag.id}`,
      type: 'GENERATED',
      transport: input.builder,
      client: input.client,
      actor: input.actor,
    })
  }

  if (input.action === 'REJECT') {
    if (!input.rejectionReason) throw new Error('Choose why this recommendation was rejected')
    await prisma.$transaction(async (tx) => {
      await tx.improvement.update({
        where: { id: improvementId },
        data: {
          status: 'REJECTED',
          rejectionReason: input.rejectionReason,
          rejectionNote: input.rejectionNote?.trim() || null,
          rejectedAt: new Date(),
        },
      })
      await appendImprovementCycleEvent({
        projectId: flag.audit.projectId!,
        improvementId,
        occurrenceId: flag.improvementOccurrence?.id,
        sourceAuditId: flag.audit.id,
        idempotencyKey: `rejected:${flag.id}:${input.rejectionReason}`,
        type: 'REJECTED',
        transport: input.builder,
        client: input.client,
        actor: input.actor,
        rejectionReason: input.rejectionReason,
        rejectionNote: input.rejectionNote?.trim() || null,
        revisitAt: input.rejectionRevisitAt,
        contextCorrection: input.contextCorrection,
      }, tx)
    })
    return {
      flagId: flag.id,
      action: input.action,
      productId: flag.audit.projectId,
      improvementId,
      attemptId: null,
      sourceReviewId: flag.audit.id,
      rejectionReason: input.rejectionReason,
      nextAction: { type: 'NONE' as const },
    }
  }

  if (input.action === 'HANDOFF_COPIED') {
    await appendImprovementCycleEvent({
      projectId: flag.audit.projectId,
      improvementId,
      occurrenceId: flag.improvementOccurrence?.id,
      sourceAuditId: flag.audit.id,
      idempotencyKey: `handoff-copied:${flag.id}:${input.builder}`,
      type: 'HANDOFF_COPIED',
      transport: input.builder,
      client: input.client,
      actor: input.actor,
    })
    return {
      flagId: flag.id,
      action: input.action,
      productId: flag.audit.projectId,
      improvementId,
      attemptId: null,
      sourceReviewId: flag.audit.id,
      nextAction: { type: 'NONE' as const },
    }
  }

  if (input.action === 'ACCEPT') {
    await prisma.$transaction(async (tx) => {
      await tx.improvement.updateMany({
        where: { id: improvementId, acceptedAt: null },
        data: { acceptedAt: new Date(), acceptedByChannel: input.builder },
      })
      await tx.improvement.updateMany({
        where: { id: improvementId, status: { in: ['PROPOSED', 'ACCEPTED'] } },
        data: { status: 'ACCEPTED' },
      })
      await appendImprovementCycleEvent({
        projectId: flag.audit.projectId!,
        improvementId,
        occurrenceId: flag.improvementOccurrence?.id,
        sourceAuditId: flag.audit.id,
        idempotencyKey: `accepted-explicit:${flag.id}`,
        type: 'ACCEPTED_EXPLICIT',
        transport: input.builder,
        client: input.client,
        actor: input.actor,
      }, tx)
    })
    return {
      flagId: flag.id,
      action: input.action,
      productId: flag.audit.projectId,
      improvementId,
      attemptId: null,
      sourceReviewId: flag.audit.id,
      nextAction: { type: 'IMPLEMENT' as const },
    }
  }

  const attempt = await createImprovementAttempt({
    improvementId,
    projectId: flag.audit.projectId,
    userId: input.userId,
    sourceAuditId: flag.audit.id,
    builder: input.builder,
    client: input.client,
    actor: input.actor,
    handoffReference: `flag:${flag.id}`,
    deploymentReference: input.deploymentReference,
    changeSummary: input.changeSummary ?? '',
  })
  return {
    flagId: flag.id,
    action: input.action,
    productId: flag.audit.projectId,
    improvementId,
    attemptId: attempt.id,
    sourceReviewId: flag.audit.id,
    nextAction: {
      type: 'RUN_UPDATE_REVIEW' as const,
      command: `fixflags recheck ${flag.audit.id}`,
    },
  }
}

export async function loadProductImprovementWorkspace(projectId: string, userId: string) {
  const product = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: {
      id: true,
      name: true,
      url: true,
      productIntelligence: true,
      watchInterval: true,
      audits: {
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: 1,
        select: { id: true, completedAt: true },
      },
      improvements: {
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        include: {
          occurrences: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            include: {
              flag: {
                select: {
                  id: true,
                  problem: true,
                  evidence: true,
                  whyItMatters: true,
                  rubric: true,
                  severity: true,
                  pageUrl: true,
                  status: true,
                },
              },
              audit: { select: { id: true, completedAt: true } },
            },
          },
          attempts: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      },
      signals: {
        where: { occurredAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        orderBy: { occurredAt: 'desc' },
        take: 500,
        select: {
          kind: true,
          name: true,
          route: true,
          sessionHash: true,
          numericValue: true,
          release: { select: { externalId: true } },
        },
      },
    },
  })
  if (!product) return null

  const actionable = product.improvements.filter(
    (improvement) =>
      improvement.status !== 'REJECTED' && improvement.status !== 'SUPERSEDED'
  )
  return {
    product: {
      id: product.id,
      name: product.name,
      url: product.url,
      memory: product.productIntelligence,
      watching: product.watchInterval !== null,
      latestReview: product.audits[0] ?? null,
    },
    attention: actionable
      .filter((improvement) => improvement.status !== 'VERIFIED')
      .slice(0, 3),
    history: product.improvements,
    signalContext: synthesizeProductSignals(product.signals),
  }
}

/** Records the exact top recommendations delivered in an owned Product workspace. */
export async function recordRecommendedImprovements(input: {
  projectId: string
  userId: string
  improvementIds: string[]
}) {
  const owned = await prisma.project.findFirst({
    where: { id: input.projectId, userId: input.userId },
    select: { id: true },
  })
  if (!owned) throw new Error('Product not found')
  const ids = [...new Set(input.improvementIds)].slice(0, 3)
  if (ids.length === 0) return 0
  const improvements = await prisma.improvement.findMany({
    where: { id: { in: ids }, projectId: input.projectId },
    select: {
      id: true,
      occurrences: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, auditId: true, flagId: true },
      },
    },
  })
  await Promise.all(improvements.map(async (improvement) => {
    const occurrence = improvement.occurrences[0]
    if (!occurrence) return
    await appendImprovementCycleEvent({
      projectId: input.projectId,
      improvementId: improvement.id,
      occurrenceId: occurrence.id,
      sourceAuditId: occurrence.auditId,
      idempotencyKey: `recommended:${occurrence.flagId}:product-workspace`,
      type: 'RECOMMENDED',
      transport: 'WEB',
      client: 'product-workspace',
      actor: input.userId,
    })
  }))
  return improvements.length
}

type VerificationResult = {
  improvementId: string
  attemptId: string
  outcome: VerificationOutcome
  status: ImprovementStatus
  problem: string
  checkId: string | null
  comparable: boolean
  reason: string
}

/**
 * Reconciles pending attempts against a fresh child Review.
 * The parent relationship is the independence boundary: arbitrary comparisons
 * cannot certify an Improvement.
 */
export async function reconcileImprovementVerification(input: {
  parentAuditId: string
  verificationAuditId: string
}): Promise<VerificationResult[]> {
  const [verificationAudit, parentOccurrences, currentFlags] = await Promise.all([
    prisma.audit.findUnique({
      where: { id: input.verificationAuditId },
      select: {
        id: true,
        parentId: true,
        projectId: true,
        productContract: true,
        status: true,
        reportCompleteness: true,
        evidenceCoverage: true,
        failedModules: true,
        journeyReviewIncluded: true,
        journeyReviewAt: true,
        pages: { select: { url: true, status: true } },
        verifierExecutions: {
          select: {
            targetKey: true,
            scopeKey: true,
            status: true,
            evidenceReference: true,
          },
        },
      },
    }),
    prisma.improvementOccurrence.findMany({
      where: { auditId: input.parentAuditId },
      include: {
        flag: true,
        improvement: {
          include: {
            attempts: {
              where: { outcome: null, sourceAuditId: input.parentAuditId },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.flag.findMany({ where: { auditId: input.verificationAuditId } }),
  ])
  if (
    !verificationAudit?.projectId ||
    verificationAudit.parentId !== input.parentAuditId
  ) {
    return []
  }

  const currentByKey = new Map(
    currentFlags.map((flag) => [improvementFingerprint(flag), flag])
  )
  const results: VerificationResult[] = []
  const reconciledImprovementIds = new Set<string>()
  for (const occurrence of parentOccurrences) {
    if (reconciledImprovementIds.has(occurrence.improvementId)) continue
    reconciledImprovementIds.add(occurrence.improvementId)
    const attempt = occurrence.improvement.attempts[0]
    if (!attempt) continue
    const current = currentByKey.get(improvementFingerprint(occurrence.flag))
    const coverageDecision = assessVerificationCoverage({
      status: verificationAudit.status,
      reportCompleteness: verificationAudit.reportCompleteness,
      evidenceCoverage: verificationAudit.evidenceCoverage,
      failedModules: verificationAudit.failedModules,
      journeyReviewIncluded: verificationAudit.journeyReviewIncluded,
      journeyReviewAt: verificationAudit.journeyReviewAt,
      pages: verificationAudit.pages,
      source: occurrence.flag.source,
      checkId: occurrence.flag.checkId,
      fingerprint: occurrence.flag.fingerprint,
      pageUrl: occurrence.flag.pageUrl,
      verifierExecutions: verificationAudit.verifierExecutions,
    })
    const stableAiIdentity =
      occurrence.flag.source !== 'AI' || Boolean(occurrence.flag.fingerprint)
    const comparable = coverageDecision.comparable && stableAiIdentity
    const reason = !stableAiIdentity
      ? 'The original AI observation has no stable evidence fingerprint for comparison.'
      : coverageDecision.reason
    const outcome: VerificationOutcome = !comparable
      ? 'INCONCLUSIVE'
      : !current
        ? 'IMPROVED'
        : current.status === 'REGRESSED'
          ? 'REGRESSED'
          : 'UNCHANGED'
    const status: ImprovementStatus = outcome === 'IMPROVED' ? 'VERIFIED' : 'UNVERIFIED'
    const evidenceReference = {
      beforeAuditId: input.parentAuditId,
      beforeFlagId: occurrence.flagId,
      afterAuditId: input.verificationAuditId,
      afterFlagId: current?.id ?? null,
    }

    await prisma.$transaction(async (tx) => {
      await tx.improvementAttempt.update({
        where: { id: attempt.id },
        data: {
          verificationAuditId: input.verificationAuditId,
          outcome,
          testedCondition: occurrence.improvement.successCondition,
          comparable,
          verificationCoverage: coverageDecision.coverage,
          verificationReason: reason,
          evidenceReference,
          remainingRisk:
            outcome === 'IMPROVED'
              ? null
              : outcome === 'INCONCLUSIVE'
                ? reason
                : 'The independent Review still observed the targeted condition.',
        },
      })
      await tx.improvement.update({
        where: { id: occurrence.improvementId },
        data: { status },
      })
      if (current) {
        await tx.improvementOccurrence.upsert({
          where: { flagId: current.id },
          create: {
            improvementId: occurrence.improvementId,
            auditId: input.verificationAuditId,
            flagId: current.id,
            kind: outcome === 'REGRESSED' ? 'REGRESSED' : 'CONFIRMED',
          },
          update: { kind: outcome === 'REGRESSED' ? 'REGRESSED' : 'CONFIRMED' },
        })
      }
      await appendImprovementCycleEvent({
        projectId: verificationAudit.projectId!,
        improvementId: occurrence.improvementId,
        occurrenceId: occurrence.id,
        sourceAuditId: input.parentAuditId,
        idempotencyKey: `outcome:${attempt.id}:${input.verificationAuditId}`,
        type: 'OUTCOME_ISSUED',
        transport: 'SYSTEM',
        attemptId: attempt.id,
        verificationAuditId: input.verificationAuditId,
        outcome,
      }, tx)
      if (outcome === 'IMPROVED') {
        await appendImprovementCycleEvent({
          projectId: verificationAudit.projectId!,
          improvementId: occurrence.improvementId,
          occurrenceId: occurrence.id,
          sourceAuditId: input.parentAuditId,
          idempotencyKey: `improved:${attempt.id}:${input.verificationAuditId}`,
          type: 'IMPROVED',
          transport: 'SYSTEM',
          attemptId: attempt.id,
          verificationAuditId: input.verificationAuditId,
          outcome,
        }, tx)
      }
    })
    results.push({
      improvementId: occurrence.improvementId,
      attemptId: attempt.id,
      outcome,
      status,
      problem: occurrence.flag.problem,
      checkId: occurrence.flag.checkId,
      comparable,
      reason,
    })
  }

  const improved = results.filter((result) => result.outcome === 'IMPROVED')
  if (improved.length > 0) {
    const contract = parseProductContract(verificationAudit.productContract)
    if (contract) {
      await mutateProjectIntelligence(verificationAudit.projectId, (current) => {
        let memory = current ?? productIntelligenceFromContract(contract)
        for (const result of improved) {
          memory = appendVerifiedLearning(memory, {
            checkId: result.checkId ?? undefined,
            summary: `Verified improvement: ${result.problem}`,
            auditId: input.verificationAuditId,
            improvementId: result.improvementId,
            attemptId: result.attemptId,
            at: new Date().toISOString(),
          })
        }
        return memory
      })
    }
  }
  return results
}
