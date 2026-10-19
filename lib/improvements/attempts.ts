import { hasRepairGuidance, repairGuidanceText } from './repair-guidance'
import { handoffProtocolSuffix } from './handoff-contract'
import {
ensureProductProject,
mutateProjectIntelligence,
} from '@/lib/audit/ensure-product-project'
import { executionTransaction,executionWrite } from '@/lib/audit/execution-ownership'
import { parseProductContract } from '@/lib/audit/product-contract'
import {
appendIntentionalNote,
appendKnownRisk,
mergeContractIntoProductIntelligence,
productIntelligenceFromContract
} from '@/lib/audit/product-intelligence'
import { prisma } from '@/lib/db'
import { appendImprovementCycleEvent } from '@/lib/improvements/cycle-ledger'
import {
normalizeImprovementRejectionReason,
type ImprovementRejectionReason,
} from '@/lib/improvements/rejection-reasons'
import { systemClock } from '@/lib/time/clock'
import type {
Prisma
} from '@prisma/client'
import { assertAttemptReplay,attemptIntentHash,normalizedAttemptValue } from './attempt-intent'

import { improvementFingerprint,occurrenceKind } from './occurrences'
import type { ImprovementServiceDependencies } from './service-types'

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
  commitReference?: string
  deploymentReference?: string
  changeSummary?: string | null
  idempotencyKey?: string
}, dependencies: ImprovementServiceDependencies = {}) {
  const clock = dependencies.clock ?? systemClock
  const changeSummary = normalizedAttemptValue(input.changeSummary)
  const idempotencyKey = input.idempotencyKey?.trim() || null
  const requestHash = idempotencyKey ? attemptIntentHash(input) : null
  const improvement = await prisma.improvement.findFirst({
    where: {
      id: input.improvementId,
      projectId: input.projectId,
      project: { userId: input.userId, deletedAt: null },
      occurrences: { some: { auditId: input.sourceAuditId } },
    },
    select: { id: true },
  })
  if (!improvement) throw new Error('Improvement not found for Product')

  return executionTransaction(async (tx) => {
    // Workers lock the owning Site before the Audit and improvement ledger.
    // Use the same order before taking the attempt lock or Audit foreign keys.
    const projects = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "projects" WHERE "id" = ${input.projectId}
        AND "userId" = ${input.userId} AND "deletedAt" IS NULL FOR UPDATE`
    if (projects.length !== 1) throw new Error('Improvement not found for Product')
    // Attempt creation and result projection share one lock across source
    // reviews, so an older run cannot overwrite a newer recorded repair.
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`fixflags:improvement-attempt:${improvement.id}`}, 0)
      )
    `
    if (idempotencyKey) {
      const recorded = await tx.improvementAttempt.findUnique({ where: { improvementId_idempotencyKey: { improvementId: improvement.id, idempotencyKey } } })
      if (recorded) {
        assertAttemptReplay(input, recorded)
        return recorded
      }
    }
    let existing = idempotencyKey ? null : await tx.improvementAttempt.findFirst({
      where: {
        improvementId: improvement.id,
        sourceAuditId: input.sourceAuditId,
        outcome: null,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    if (existing?.frozen || existing?.idempotencyKey || existing?.verificationAuditId) {
      const changed = (['handoffReference', 'pullRequestReference', 'commitReference', 'deploymentReference', 'changeSummary'] as const)
        .some(key => input[key] !== undefined && normalizedAttemptValue(input[key]) !== normalizedAttemptValue(existing![key]))
      if (!changed) return existing
      existing = null
    }
    const accepted = await tx.improvement.updateMany({
      where: { id: improvement.id, acceptedAt: null },
      data: { acceptedAt: clock.now(), acceptedByChannel: input.builder },
    })
    const data = {
      builder: input.builder,
      handoffReference: normalizedAttemptValue(input.handoffReference) ?? undefined,
      pullRequestReference: normalizedAttemptValue(input.pullRequestReference) ?? undefined,
      commitReference: normalizedAttemptValue(input.commitReference) ?? undefined,
      deploymentReference: normalizedAttemptValue(input.deploymentReference) ?? undefined,
      // An omitted description is honest. On a retry it must not erase an
      // earlier description on the same pending attempt.
      changeSummary: changeSummary ?? (existing ? undefined : null),
    }
    let attempt
    if (existing) {
      // Admission can bind this legacy draft while this transaction is reading
      // it. Freeze the row atomically, rather than overwriting an admitted fix.
      const changed = await tx.improvementAttempt.updateMany({ where: { id: existing.id, idempotencyKey: null,
        verificationAuditId: null, outcome: null, frozen: false }, data })
      const current = await tx.improvementAttempt.findUniqueOrThrow({ where: { id: existing.id } })
      if (changed.count > 0) attempt = current
      else if ((['handoffReference', 'pullRequestReference', 'commitReference', 'deploymentReference', 'changeSummary'] as const)
        .every(key => input[key] === undefined || normalizedAttemptValue(input[key]) === normalizedAttemptValue(current[key]))) return current
    }
    if (!attempt) attempt = await tx.improvementAttempt.create({
          data: {
            improvementId: improvement.id,
            sourceAuditId: input.sourceAuditId,
            ...data,
            idempotencyKey,
            requestHash,
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
  commitReference?: string
  idempotencyKey?: string
  rejectionReason?: ImprovementRejectionReason
  rejectionNote?: string
  rejectionRevisitAt?: Date
  contextCorrection?: Prisma.InputJsonValue
  rejectionStatus?: 'REJECTED' | 'SUPERSEDED'
}, dependencies: ImprovementServiceDependencies = {}) {
  const clock = dependencies.clock ?? systemClock
  const flag = await prisma.flag.findFirst({
    where: { id: input.flagId, audit: { userId: input.userId } },
    include: {
      improvementOccurrence: { select: { id: true, improvementId: true } },
      audit: { select: { id: true, projectId: true, productContract: true } },
    },
  })
  if (!flag?.audit.projectId) throw new Error('Flag is not attached to an owned Product')
  if (input.action === 'HANDOFF_COPIED' && !hasRepairGuidance(repairGuidanceText(flag))) throw new Error('Repair guidance is unavailable for this Flag')
  const projectId = flag.audit.projectId

  let improvementId = flag.improvementOccurrence?.improvementId
  if (!improvementId) {
    const contract = parseProductContract(flag.audit.productContract)
    const fingerprint = improvementFingerprint(flag)
    const linked = await executionTransaction(async tx => {
      const owned = await tx.flag.findFirst({ where: { id: flag.id,
        audit: { userId: input.userId, projectId, project: { userId: input.userId } } }, select: { id: true } })
      if (!owned) throw new Error('Flag is not attached to an owned Product')
      // Empty-update ORM upserts can race through read-then-create. Native
      // conflict-safe inserts converge without rewriting existing history.
      await tx.improvement.createMany({ data: [{ projectId, fingerprint, title: flag.problem,
        judgment: flag.whyItMatters, expectedBenefit: flag.whyItMatters, recommendedChange: repairGuidanceText(flag),
        protectedScope: contract?.criticalOutcomes.length ? 'Keep these Product outcomes unchanged: ' + contract.criticalOutcomes.join('; ') : null,
        successCondition: flag.verificationRule || 'A fresh Product Review no longer observes: ' + flag.problem,
        priority: 50, status: 'PROPOSED' }], skipDuplicates: true })
      const improvement = await tx.improvement.findUniqueOrThrow({ where: { projectId_fingerprint: { projectId, fingerprint } }, select: { id: true } })
      const created = await tx.improvementOccurrence.createMany({ data: [{ improvementId: improvement.id,
        auditId: flag.audit.id, flagId: flag.id, kind: occurrenceKind(flag.status) }], skipDuplicates: true })
      const occurrence = await tx.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
      if (created.count > 0) await appendImprovementCycleEvent({ projectId, improvementId: occurrence.improvementId,
        occurrenceId: occurrence.id, sourceAuditId: flag.audit.id, idempotencyKey: 'generated:' + flag.id,
        type: 'GENERATED', transport: input.builder, client: input.client, actor: input.actor }, tx)
      return occurrence
    })
    improvementId = linked.improvementId
  }

  if (input.action === 'REJECT') {
    if (!input.rejectionReason) throw new Error('Choose why this recommendation was rejected')
    await executionTransaction(async (tx) => {
      await tx.improvement.update({
        where: { id: improvementId },
        data: {
          status: input.rejectionStatus ?? 'REJECTED',
          rejectionReason: input.rejectionReason,
          rejectionNote: input.rejectionNote?.trim() || null,
          rejectedAt: clock.now(),
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
      idempotencyKey: `handoff-copied:${flag.id}${handoffProtocolSuffix(input.client)}`,
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
    await executionTransaction(async (tx) => {
      await tx.improvement.updateMany({
        where: { id: improvementId, acceptedAt: null },
        data: { acceptedAt: clock.now(), acceptedByChannel: input.builder },
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
    commitReference: input.commitReference,
    idempotencyKey: input.idempotencyKey,
    changeSummary: input.changeSummary,
  }, { clock })
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
    commitReference: attempt.commitReference ?? null,
    deploymentReference: attempt.deploymentReference ?? null,
    changeSummary: attempt.changeSummary ?? null,
    verificationAuditId: attempt.verificationAuditId ?? null,
    outcome: attempt.outcome ?? null,
  }
}

export async function recordOwnerFlagFeedbackDecision(input: {
  flagId: string
  userId: string
  reason: string
  note?: string
}, dependencies: ImprovementServiceDependencies = {}) {
  const clock = dependencies.clock ?? systemClock
  const flag = await prisma.flag.findFirst({
    where: { id: input.flagId, audit: { userId: input.userId } },
    select: {
      id: true,
      problem: true,
      audit: {
        select: {
          id: true,
          url: true,
          projectId: true,
          productContract: true,
        },
      },
    },
  })
  if (!flag) throw new Error('Flag is not attached to an owned Product')

  let projectId = flag.audit.projectId
  if (!projectId) {
    const project = await ensureProductProject(input.userId, flag.audit.url)
    projectId = project.id
    await executionWrite(tx => tx.audit.update({
      where: { id: flag.audit.id },
      data: { projectId },
    }))
  }

  const note = input.note?.trim()
  const result = input.reason === 'already_fixed'
    ? await recordFlagImprovementAttempt({
        flagId: input.flagId,
        userId: input.userId,
        builder: 'user-decision',
        actor: input.userId,
        action: 'READY_TO_VERIFY',
        changeSummary: note || 'The owner reports this change is ready to verify.',
      }, { clock })
    : await recordFlagImprovementAttempt({
        flagId: input.flagId,
        userId: input.userId,
        builder: 'user-decision',
        actor: input.userId,
        action: 'REJECT',
        rejectionReason:
          normalizeImprovementRejectionReason(input.reason) ?? 'WEAK_RECOMMENDATION',
        rejectionNote: note,
        rejectionStatus: input.reason === 'duplicate' ? 'SUPERSEDED' : 'REJECTED',
      }, { clock })

  await executionWrite(tx => tx.flag.update({
    where: { id: input.flagId },
    data: { status: 'IGNORED' },
  }))

  if (input.reason === 'intentional' || input.reason === 'low_priority') {
    const contract = parseProductContract(flag.audit.productContract)
    const fallback = contract
      ? mergeContractIntoProductIntelligence(null, contract)
      : productIntelligenceFromContract({
          purpose: 'Help visitors get value from this product',
          firstValueJourney: 'Complete the primary journey',
          criticalOutcomes: ['Primary outcomes work'],
          inferredAt: clock.now().toISOString(),
          source: 'heuristic',
        })
    const decisionNote = note ? `${flag.problem} - ${note}` : flag.problem
    await mutateProjectIntelligence(projectId, (current) => {
      const intelligence = current ?? fallback
      return input.reason === 'low_priority'
        ? appendKnownRisk(intelligence, decisionNote)
        : appendIntentionalNote(intelligence, decisionNote)
    })
  }

  return result
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
