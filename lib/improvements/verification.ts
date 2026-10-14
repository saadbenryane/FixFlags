import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import {
mutateProjectIntelligence
} from '@/lib/audit/ensure-product-project'
import { executionTransaction } from '@/lib/audit/execution-ownership'
import { parseProductContract } from '@/lib/audit/product-contract'
import {
appendVerifiedLearning,
productIntelligenceFromContract
} from '@/lib/audit/product-intelligence'
import { prisma } from '@/lib/db'
import { appendImprovementCycleEvent } from '@/lib/improvements/cycle-ledger'
import { assessTargetedOutcomeCoverage,assessVerificationCoverage } from '@/lib/improvements/verification-coverage'
import { readVerificationTarget } from '@/lib/sites/domain/execution-spec'
import { readOutcomeIncident } from '@/lib/sites/domain/outcome-incident'
import { hasRecordedRecoveryEvidence } from '@/lib/audit/recovery-evidence'
import { systemClock } from '@/lib/time/clock'
import type {
ImprovementStatus,
VerificationOutcome
} from '@prisma/client'

import { improvementFingerprint } from './occurrences'
import type { ImprovementServiceDependencies,VerificationResult } from './service-types'

/**
 * Reconciles pending attempts against a fresh child Review.
 * A direct child or committed recovery of the exact source incident supplies
 * the independent run. Both require the original responsibility's scope proof.
 */
export async function reconcileImprovementVerification(input: {
  parentAuditId: string
  verificationAuditId: string
}, dependencies: ImprovementServiceDependencies = {}): Promise<VerificationResult[]> {
  const clock = dependencies.clock ?? systemClock
  const verificationAudit = await prisma.audit.findUnique({
      where: { id: input.verificationAuditId },
      select: {
        id: true,
        parentId: true,
        projectId: true,
        productContract: true,
        executionSpec: true,
        status: true,
        startedAt: true,
        reportCompleteness: true,
        evidenceCoverage: true,
        failedModules: true,
        journeyReviewIncluded: true,
        journeyReviewAt: true,
        pages: { select: { url: true, status: true } },
        runRequests: { select: {
          id: true, projectId: true, status: true, environment: true, verificationTarget: true,
          assessments: { select: { outcomeId: true, auditId: true, runRequestId: true, state: true, coverage: true, evidence: true } },
        } },
        verifierExecutions: {
          select: {
            targetKey: true,
            scopeKey: true,
            status: true,
            evidenceReference: true,
            detail: true,
          },
        },
      },
    })
  if (!verificationAudit?.projectId || verificationAudit.parentId !== input.parentAuditId) return []
  const targetedRun = verificationAudit.runRequests?.find(run => run.verificationTarget != null)
  const target = readVerificationTarget(targetedRun?.verificationTarget)
  if (targetedRun && (!target || target.parentAuditId !== input.parentAuditId || targetedRun.projectId !== verificationAudit.projectId)) return []
  const [parentOccurrences, currentFlags] = await Promise.all([
    prisma.improvementOccurrence.findMany({
      where: { auditId: input.parentAuditId },
      include: {
        flag: true,
        improvement: {
          include: {
            attempts: {
              where: { outcome: null, sourceAuditId: input.parentAuditId, ...(target ? { id: target.attemptId }
                : verificationAudit.startedAt ? { createdAt: { lte: verificationAudit.startedAt } } : {}) },
              orderBy: { createdAt: 'desc' },
              take: target ? 1 : 500,
            },
          },
        },
      },
    }),
    prisma.flag.findMany({ where: { auditId: input.verificationAuditId } }),
  ])
  const recoveredOutcomeIds = verificationAudit.status === 'COMPLETED' ? verificationAudit.runRequests?.flatMap(run =>
    run.verificationTarget === null && run.projectId === verificationAudit.projectId && run.status === 'COMPLETED'
      ? run.assessments.filter(assessment => assessment.auditId === verificationAudit.id && assessment.runRequestId === run.id &&
        assessment.state === 'CLEAR' && readOutcomeIncident(assessment.evidence)?.transition === 'recovery').map(assessment => assessment.outcomeId)
      : []) ?? [] : []
  // Query unresolved fixes rather than every Flag accumulated during an outage.
  // Only a source Flag closed by this exact recovery can resume an inconclusive fix.
  const hasTargetedRun = verificationAudit.runRequests?.some(run => run.verificationTarget !== null)
  const recoveredAttempts = verificationAudit.status === 'COMPLETED' && verificationAudit.startedAt && !hasTargetedRun
    ? await prisma.improvementAttempt.findMany({
        where: { improvement: { projectId: verificationAudit.projectId,
            OR: [{ outcomeId: null }, { outcomeId: { in: recoveredOutcomeIds } }],
            status: { notIn: ['REJECTED', 'SUPERSEDED'] } },
          sourceAudit: { projectId: verificationAudit.projectId, flags: { some: { status: 'FIXED', resolvedInId: verificationAudit.id } } },
          OR: [{ outcome: null }, { outcome: 'INCONCLUSIVE' }], createdAt: { lte: verificationAudit.startedAt } },
        orderBy: { createdAt: 'desc' },
        include: { improvement: true, sourceAudit: { select: { improvementOccurrences: { include: { flag: true } } } } },
      }) : []
  const recoveredOccurrences = recoveredAttempts.flatMap(attempt => {
    if (attempt.improvement.outcomeId && !recoveredOutcomeIds.includes(attempt.improvement.outcomeId)) return []
    const occurrence = attempt.sourceAudit.improvementOccurrences.find(item => item.improvementId === attempt.improvementId &&
      item.flag.status === 'FIXED' && item.flag.resolvedInId === verificationAudit.id)
    return occurrence ? [{ ...occurrence, improvement: { ...attempt.improvement, attempts: [attempt] } }] : []
  })
  const occurrences = [...recoveredOccurrences, ...parentOccurrences].flatMap(occurrence =>
    occurrence.improvement.attempts.map(attempt => ({ ...occurrence, improvement: { ...occurrence.improvement, attempts: [attempt] } })))

  const currentByKey = new Map(
    currentFlags.map((flag) => [improvementFingerprint(flag), flag])
  )
  const results: VerificationResult[] = []
  const reconciledAttemptIds = new Set<string>()
  for (const occurrence of occurrences) {
    if (occurrence.improvement.status === 'REJECTED' || occurrence.improvement.status === 'SUPERSEDED') continue
    const sourceAuditId = occurrence.auditId
    const attempt = occurrence.improvement.attempts.find(item => item.sourceAuditId === sourceAuditId)
    if (!attempt) continue
    // One targeted request is not authority to reconcile another pending fix.
    if (target && target.attemptId !== attempt.id) continue
    if (reconciledAttemptIds.has(attempt.id)) continue
    reconciledAttemptIds.add(attempt.id)
    const current = currentByKey.get(occurrence.improvement.fingerprint ?? improvementFingerprint(occurrence.flag))
    let coverageDecision = assessVerificationCoverage({
      auditId: verificationAudit.id,
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
      executionSpec: verificationAudit.executionSpec,
      originalFlag: occurrence.flag,
      verifierExecutions: verificationAudit.verifierExecutions,
    })
    const outcomeRun = target?.kind === 'OUTCOME' ? targetedRun : !target && occurrence.improvement.outcomeId
      ? verificationAudit.runRequests?.find(run => run.verificationTarget === null && run.projectId === verificationAudit.projectId &&
        run.assessments.some(assessment => assessment.outcomeId === occurrence.improvement.outcomeId)) : null
    if (outcomeRun) {
      const sourceAssessment = occurrence.improvement.outcomeId
        ? await prisma.outcomeAssessment.findFirst({
            where: { auditId: sourceAuditId, outcomeId: occurrence.improvement.outcomeId },
            orderBy: { assessedAt: 'desc' }, select: { state: true, coverage: true },
          }) : null
      coverageDecision = assessTargetedOutcomeCoverage({
        auditId: verificationAudit.id, auditStatus: verificationAudit.status,
        projectId: verificationAudit.projectId, parentAuditId: sourceAuditId,
        outcomeId: occurrence.improvement.outcomeId, attemptId: attempt.id,
        run: outcomeRun, sourceAssessment, targeted: target?.kind === 'OUTCOME',
      })
    }
    const stableAiIdentity =
      occurrence.flag.source !== 'AI' || Boolean(occurrence.flag.fingerprint)
    const comparable = coverageDecision.comparable && stableAiIdentity
    const reason = !stableAiIdentity
      ? 'The original AI observation has no stable evidence fingerprint for comparison.'
      : coverageDecision.reason
    const targetedState = outcomeRun?.assessments.find(item => item.outcomeId === occurrence.improvement.outcomeId)?.state ?? null
    const verificationVerdict = coverageDecision.verdict
    const outcome: VerificationOutcome = !comparable
      ? 'INCONCLUSIVE'
      : targetedState === 'FLAG'
        ? current?.status === 'REGRESSED' ? 'REGRESSED' : 'UNCHANGED'
      : verificationVerdict === 'passed'
        ? 'IMPROVED'
      : verificationVerdict === 'failed'
        ? current?.status === 'REGRESSED' ? 'REGRESSED' : 'UNCHANGED'
      : !current
        ? 'IMPROVED'
        : current.status === 'REGRESSED'
          ? 'REGRESSED'
          : 'UNCHANGED'
    let status: ImprovementStatus = outcome === 'IMPROVED' ? 'VERIFIED' : 'UNVERIFIED'
    const evidenceReference = {
      beforeAuditId: sourceAuditId,
      beforeFlagId: occurrence.flagId,
      afterAuditId: input.verificationAuditId,
      afterFlagId: current?.id ?? null,
    }

    await executionTransaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'fixflags:improvement-attempt:' + occurrence.improvementId}, 0))`
      const latestAttempt = await tx.improvementAttempt.findFirst({ where: { improvementId: occurrence.improvementId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } })
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
      if (target && outcome === 'IMPROVED') {
        // Targeted runs skip the broad report diff. Their exact repair proof
        // must still resolve the source Flag alongside the verified attempt.
        await tx.flag.updateMany({
          where: { id: occurrence.flagId, auditId: sourceAuditId,
            audit: { projectId: verificationAudit.projectId }, status: { in: ['OPEN', 'REGRESSED'] } },
          data: { status: 'FIXED', resolvedInId: input.verificationAuditId },
        })
        if (target.kind === 'DIAGNOSTIC' && verificationAudit.startedAt) {
          const unresolved = await tx.flag.findMany({ where: {
            improvementOccurrence: { improvementId: occurrence.improvementId }, audit: { projectId: verificationAudit.projectId },
            source: 'DETERMINISTIC', status: { in: ['OPEN', 'REGRESSED'] }, createdAt: { lte: verificationAudit.startedAt },
          }, take: 100, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: {
            id: true, checkId: true, pageUrl: true, affectedPaths: true, attentionPolicy: true, evidenceTargets: true, verificationRule: true,
          } })
          const recovered = unresolved.filter(flag => hasRecordedRecoveryEvidence({ auditId: verificationAudit.id,
            executionSpec: verificationAudit.executionSpec, flag, executions: verificationAudit.verifierExecutions }))
          if (recovered.length) await tx.flag.updateMany({ where: {
            id: { in: recovered.map(flag => flag.id) }, audit: { projectId: verificationAudit.projectId },
            source: 'DETERMINISTIC', status: { in: ['OPEN', 'REGRESSED'] }, createdAt: { lte: verificationAudit.startedAt },
          }, data: { status: 'FIXED', resolvedInId: input.verificationAuditId } })
        }
      }
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
      if (!latestAttempt || latestAttempt.id === attempt.id) {
        // An exact repair can succeed while another occurrence remains open.
        // Keep that incident visible without changing the successful attempt.
        if (outcome === 'IMPROVED' && await tx.flag.findFirst({ where: {
          improvementOccurrence: { improvementId: occurrence.improvementId },
          audit: { projectId: verificationAudit.projectId }, status: { in: ['OPEN', 'REGRESSED'] },
        }, select: { id: true } })) status = 'PROPOSED'
        await tx.improvement.update({ where: { id: occurrence.improvementId }, data: { status } })
      }
      await appendImprovementCycleEvent({
        projectId: verificationAudit.projectId!,
        improvementId: occurrence.improvementId,
        occurrenceId: occurrence.id,
        sourceAuditId,
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
          sourceAuditId,
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
    await recordSiteLifecycleEvent({
      name: 'verify_result',
      idempotencyKey: `verify-result:${attempt.id}:${input.verificationAuditId}`,
      projectId: verificationAudit.projectId,
      properties: { outcome, comparable },
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
            at: clock.now().toISOString(),
          })
        }
        return memory
      })
    }
  }
  return results
}
