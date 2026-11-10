import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { VERIFICATION_EVIDENCE_COPY } from '@/lib/marketing/copy/verification-evidence'
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
import { canonicalIntent, readExecutionSpec, readVerificationTarget } from '@/lib/sites/domain/execution-spec'
import { readOutcomeIncident, readOutcomeRecovery } from '@/lib/sites/domain/outcome-incident'
import { loadOutcomeRepairSource } from '@/lib/sites/application/outcome-repair-source'
import { createRecordedRecoveryReader, type RecoveryFlag } from '@/lib/audit/recovery-evidence'
import { baseCheckId, outcomeFlagOwner, parseAffectedPaths } from '@/lib/audit/flag-identity'
import { observationTargetSchema, readSupportingObservations } from '@/lib/audit/flag-observations'
import { systemClock } from '@/lib/time/clock'
import type {
Flag,ImprovementAttempt,ImprovementStatus,Prisma,
VerificationOutcome
} from '@prisma/client'

import { improvementFingerprint } from './occurrences'
import { lockImprovementLedger } from './ledger-lock'
import { readRepairSources, repairSourceSelect } from '@/lib/sites/domain/repair-source'
import { attemptTargetsFlag } from './attempt-state'
import { normalizeVerifierUrl } from './verifier-scope'
import type { ImprovementServiceDependencies,VerificationResult } from './service-types'

function repairAnchor<T extends { flagId: string; auditId: string }>(occurrences: readonly T[],
  attempt: Pick<ImprovementAttempt, 'sourceAuditId' | 'sourceFlagIds' | 'handoffReference'>): T | undefined {
  const scoped = occurrences.filter(occurrence => occurrence.auditId === attempt.sourceAuditId &&
    attemptTargetsFlag(attempt, occurrence.auditId, occurrence.flagId))
  if (attempt.handoffReference?.startsWith('flag:'))
    return scoped.find(occurrence => attempt.handoffReference === 'flag:' + occurrence.flagId)
  // Older attempts without a Flag reference are usable only if the recorded
  // Audit and any retained membership identify a single original occurrence.
  return scoped.length === 1 ? scoped[0] : undefined
}

type RepairObservation = RecoveryFlag & Pick<Flag, 'source' | 'checkId' | 'fingerprint' | 'pageUrl'>

/** A shared Improvement identifies a family of failures. Evidence links need
 * matching conditions, independent of coordinates, display text and task IDs. */
function failureScope(flag: RepairObservation): string | null {
  const observations = readSupportingObservations(flag.supportingObservations)
  if (flag.supportingObservations != null && !observations) return null
  const scopes = (observations?.items ?? [flag]).map(observation => {
    const rawTargets = observation.evidenceTargets ?? []
    if (!Array.isArray(rawTargets) || observations && flag.attentionPolicy != null && observation.attentionPolicy === undefined) return null
    const targets = rawTargets.map(target => observationTargetSchema.safeParse(target))
    if (targets.some(target => !target.success)) return null
    return canonicalIntent({ source: observation.source, checkId: baseCheckId(observation.checkId),
      pageUrl: observation.pageUrl ? normalizeVerifierUrl(observation.pageUrl) : null,
      checkVersion: 'checkVersion' in observation ? observation.checkVersion : null,
      verificationRule: observation.verificationRule ?? null, attentionPolicy: observation.attentionPolicy ?? null,
      targets: [...new Set(targets.flatMap(({ data: target }) =>
        target ? [canonicalIntent([target.kind, target.device, target.selector, target.context])] : []))].sort(),
    })
  })
  if (scopes.some(scope => scope === null)) return null
  const pages = [...parseAffectedPaths(flag.affectedPaths), ...(flag.pageUrl ? [flag.pageUrl] : [])]
  return canonicalIntent({ pages: [...new Set(pages.map(normalizeVerifierUrl))].sort(), scopes: [...new Set(scopes)].sort() })
}

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
        verificationReceipts: {
          // Collector journals and scheduling records are not repair verdicts.
          where: { OR: ['check:', 'module:', 'ai:'].map(prefix => ({ targetKey: { startsWith: prefix } })) },
          select: {
            targetKey: true,
            scopeKey: true,
            status: true,
            pageUrl: true,
            task: { select: { id: true, pageUrl: true } },
            evidenceReference: true,
            detail: true,
          },
        },
      },
    })
  if (!verificationAudit?.projectId || verificationAudit.parentId !== input.parentAuditId) return []
  const projectId = verificationAudit.projectId
  const targetedRun = verificationAudit.runRequests?.find(run => run.verificationTarget != null)
  const target = readVerificationTarget(targetedRun?.verificationTarget)
  if (targetedRun && (!target || target.parentAuditId !== input.parentAuditId || targetedRun.projectId !== verificationAudit.projectId)) return []
  const [parentOccurrences, currentFlags] = await Promise.all([
    prisma.improvementOccurrence.findMany({
      where: { auditId: input.parentAuditId, audit: { projectId }, improvement: { projectId } },
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
        readOutcomeRecovery(assessment.evidence, assessment.state)).map(assessment => assessment.outcomeId)
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
  const parentByImprovement = Map.groupBy(parentOccurrences, occurrence => occurrence.improvementId)
  const recoveredOccurrences = recoveredAttempts.flatMap(attempt => {
    if (attempt.improvement.outcomeId && !recoveredOutcomeIds.includes(attempt.improvement.outcomeId)) return []
    const sources = attempt.sourceAudit.improvementOccurrences.filter(item => item.improvementId === attempt.improvementId)
    const occurrence = repairAnchor(sources, attempt)
    const recovered = sources.some(item => attemptTargetsFlag(attempt, item.auditId, item.flagId) &&
      item.flag.status === 'FIXED' && item.flag.resolvedInId === verificationAudit.id)
    return occurrence && recovered ? [{ ...occurrence, improvement: { ...attempt.improvement, attempts: [attempt] } }] : []
  })
  const parentRepairs = [...parentByImprovement.values()].flatMap(occurrences =>
    occurrences[0].improvement.attempts.flatMap(attempt => {
      const occurrence = repairAnchor(occurrences, attempt)
      return occurrence ? [{ ...occurrence, improvement: { ...occurrence.improvement, attempts: [attempt] } }] : []
    }))
  const occurrences = [...recoveredOccurrences, ...parentRepairs]

  const currentByKey = Map.groupBy(currentFlags.filter(flag => flag.status !== 'FIXED'), improvementFingerprint)
  const results: VerificationResult[] = []
  const reconciledAttemptIds = new Set<string>()
  const recoveryReader = createRecordedRecoveryReader({ auditId: verificationAudit.id,
    executionSpec: verificationAudit.executionSpec, executions: verificationAudit.verificationReceipts })
  for (const occurrence of occurrences) {
    if (occurrence.improvement.status === 'REJECTED' || occurrence.improvement.status === 'SUPERSEDED') continue
    const sourceAuditId = occurrence.auditId
    const attempt = occurrence.improvement.attempts.find(item => item.sourceAuditId === sourceAuditId)
    if (!attempt) continue
    // One targeted request is not authority to reconcile another pending fix.
    if (target && target.attemptId !== attempt.id) continue
    if (reconciledAttemptIds.has(attempt.id)) continue
    reconciledAttemptIds.add(attempt.id)
    const candidates = currentByKey.get(occurrence.improvement.fingerprint ?? improvementFingerprint(occurrence.flag)) ?? []
    const assessSource = (flag: RepairObservation) => assessVerificationCoverage({
      auditId: verificationAudit.id,
      status: verificationAudit.status,
      reportCompleteness: verificationAudit.reportCompleteness,
      evidenceCoverage: verificationAudit.evidenceCoverage,
      failedModules: verificationAudit.failedModules,
      journeyReviewIncluded: verificationAudit.journeyReviewIncluded,
      journeyReviewAt: verificationAudit.journeyReviewAt,
      pages: verificationAudit.pages,
      source: flag.source,
      checkId: flag.checkId,
      fingerprint: flag.fingerprint,
      pageUrl: flag.pageUrl,
      executionSpec: verificationAudit.executionSpec,
      originalFlag: flag,
      verifierExecutions: verificationAudit.verificationReceipts,
    }, recoveryReader)
    const original = readRepairSources(attempt.sourceObservations)
    const selectedIds = original?.flags.map(flag => flag.id) ?? attempt.sourceFlagIds
    let assessedSource: RepairObservation = original?.flags.find(flag => flag.id === occurrence.flagId) ?? occurrence.flag
    let coverageDecision = assessSource(assessedSource)
    if ((selectedIds?.length || attempt.sourceObservations != null) && !occurrence.improvement.outcomeId) {
      const liveSources = await prisma.flag.findMany({ where: { id: { in: selectedIds ?? [] },
        audit: { projectId: verificationAudit.projectId }, improvementOccurrence: { improvementId: attempt.improvementId } },
        select: repairSourceSelect })
      const sources = original?.flags ?? liveSources
      const admitted = readExecutionSpec(verificationAudit.executionSpec)
      const frozenScope = !target || canonicalIntent(admitted?.verificationSourceFlagIds?.toSorted()) === canonicalIntent(selectedIds?.toSorted())
      const sameObservations = attempt.sourceObservations == null || Boolean(original && (!target ||
        canonicalIntent(admitted?.verificationSources) === canonicalIntent(original)))
      const decisions = sources.map(source => ({ source, decision: assessSource(source) }))
      const failure = decisions.find(({ decision }) => decision.comparable && decision.verdict === 'failed')
      const gap = decisions.find(({ decision }) => !decision.comparable || decision.verdict !== 'passed')
      const complete = liveSources.length === selectedIds?.length && sources.length === selectedIds?.length && frozenScope && sameObservations
      // Every selected capture must recover. A comparable remaining failure
      // still proves the repair incomplete when another capture is unavailable.
      if (!complete) coverageDecision = { ...coverageDecision, comparable: false, verdict: null,
        reason: VERIFICATION_EVIDENCE_COPY.recheck.repairScopeLost }
      else if (failure) {
        coverageDecision = failure.decision
        assessedSource = failure.source
      }
      else if (gap) coverageDecision = { ...gap.decision, comparable: false, verdict: null }
      else coverageDecision = { ...coverageDecision, comparable: true, verdict: 'passed' }
    }
    const outcomeRun = target?.kind === 'OUTCOME' ? targetedRun : !target && occurrence.improvement.outcomeId
      ? verificationAudit.runRequests?.find(run => run.verificationTarget === null && run.projectId === verificationAudit.projectId &&
        run.assessments.some(assessment => assessment.outcomeId === occurrence.improvement.outcomeId)) : null
    const bound = outcomeFlagOwner(assessedSource.fingerprint)
    const bindingKey = bound?.outcomeId === occurrence.improvement.outcomeId ? bound?.bindingKey : undefined
    if (outcomeRun) {
      const sourceAssessment = occurrence.improvement.outcomeId && verificationAudit.projectId
        ? await loadOutcomeRepairSource(prisma, { projectId: verificationAudit.projectId, sourceAuditId,
            outcomeId: occurrence.improvement.outcomeId, improvementId: occurrence.improvementId, flagId: occurrence.flagId }) : null
      coverageDecision = assessTargetedOutcomeCoverage({
        auditId: verificationAudit.id, auditStatus: verificationAudit.status,
        projectId: verificationAudit.projectId, parentAuditId: sourceAuditId,
        outcomeId: occurrence.improvement.outcomeId, attemptId: attempt.id, outcomeKind: sourceAssessment?.kind,
        run: outcomeRun, sourceAssessment, targeted: target?.kind === 'OUTCOME', bindingKey,
        recoveredByRun: occurrence.flag.status === 'FIXED' && occurrence.flag.resolvedInId === verificationAudit.id,
      })
    }
    const stableAiIdentity =
      occurrence.flag.source !== 'AI' || Boolean(occurrence.flag.fingerprint)
    const assessment = outcomeRun?.assessments.find(item => item.outcomeId === occurrence.improvement.outcomeId &&
      item.auditId === verificationAudit.id && item.runRequestId === outcomeRun.id)
    const verificationVerdict = coverageDecision.verdict
    let failures: Flag[] = []
    let sourceScope: string | null = null
    if (coverageDecision.comparable && stableAiIdentity && verificationVerdict !== 'passed' && assessment?.state !== 'CLEAR') {
      if (outcomeRun) {
        const recordedIds = readOutcomeIncident(assessment?.evidence)?.flagIds ?? []
        failures = candidates.filter(flag => recordedIds.includes(flag.id) && (!bindingKey || flag.fingerprint === assessedSource.fingerprint))
      } else {
        sourceScope = failureScope(assessedSource)
        if (sourceScope !== null) failures = candidates.filter(flag => failureScope(flag) === sourceScope)
      }
    }
    const current = failures.length === 1 ? failures[0] : undefined

    const recorded = await executionTransaction(async (tx) => {
      // Collection takes the Site lock before changing a live Flag. Re-read
      // closure conditions under that same lock before resolving any source.
      const project = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "projects" WHERE "id" = ${projectId} AND "deletedAt" IS NULL FOR UPDATE`
      if (!project.length) return false
      await lockImprovementLedger(tx, occurrence.improvementId)
      const latestAttempt = await tx.improvementAttempt.findFirst({ where: { improvementId: occurrence.improvementId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } })
      const liveFailure = current ? await tx.flag.findFirst({ where: {
        id: current.id, auditId: verificationAudit.id, audit: { projectId }, status: { not: 'FIXED' },
        OR: [{ improvementOccurrence: null }, { improvementOccurrence: { improvementId: occurrence.improvementId } }],
      } }) : null
      const linkedFailure = liveFailure && current && improvementFingerprint(liveFailure) === improvementFingerprint(current) &&
        (outcomeRun || failureScope(liveFailure) === sourceScope) ? liveFailure : null
      // A historical completion receipt can lack an explicit verdict. A
      // sibling or ambiguous Flag cannot supply its missing conclusion.
      const unknownLegacyContinuation = !outcomeRun && verificationVerdict == null && candidates.length > 0 && !linkedFailure
      const comparable = coverageDecision.comparable && stableAiIdentity && !unknownLegacyContinuation
      const reason = !stableAiIdentity ? VERIFICATION_EVIDENCE_COPY.recheck.noFingerprint
        : coverageDecision.comparable && unknownLegacyContinuation ? VERIFICATION_EVIDENCE_COPY.recheck.noContinuation
          : coverageDecision.reason
      const outcome: VerificationOutcome = !comparable ? 'INCONCLUSIVE'
        : verificationVerdict === 'passed' ? 'IMPROVED'
        : assessment?.state === 'FLAG' || verificationVerdict === 'failed' || linkedFailure
          ? linkedFailure?.status === 'REGRESSED' ? 'REGRESSED' : 'UNCHANGED'
          : 'IMPROVED'
      let status: ImprovementStatus = outcome === 'IMPROVED' ? 'VERIFIED' : 'UNVERIFIED'
      // The selected attempt can settle or acquire another verification while
      // evidence is assessed. The advisory lock serializes commits, but only
      // this comparison prevents a stale snapshot from replacing newer facts.
      const claimed = await tx.improvementAttempt.updateMany({
        where: { id: attempt.id, improvementId: occurrence.improvementId, sourceAuditId,
          outcome: attempt.outcome ?? null, verificationAuditId: attempt.verificationAuditId ?? null,
          // Unadmitted legacy drafts can change while coverage is being read.
          ...(attempt.frozen ? {} : { updatedAt: attempt.updatedAt, handoffReference: attempt.handoffReference ?? null,
            sourceFlagIds: { equals: attempt.sourceFlagIds ?? [] } }),
          sourceAudit: { projectId },
          improvement: { projectId, status: { notIn: ['REJECTED', 'SUPERSEDED'] } } },
        data: {
          verificationAuditId: input.verificationAuditId,
          outcome,
          testedCondition: original?.flags.find(flag => flag.id === occurrence.flagId)?.verificationRule ?? occurrence.improvement.successCondition,
          comparable,
          verificationCoverage: unknownLegacyContinuation ? { ...coverageDecision.coverage, evidenceComparable: false } : coverageDecision.coverage,
          verificationReason: reason,
          evidenceReference: {
            beforeAuditId: sourceAuditId, beforeFlagId: occurrence.flagId, afterAuditId: input.verificationAuditId,
            afterFlagId: linkedFailure?.id ?? null,
            ...(attempt.sourceFlagIds?.length ? { beforeFlagIds: attempt.sourceFlagIds } : {}),
          },
          remainingRisk:
            outcome === 'IMPROVED'
              ? null
              : outcome === 'INCONCLUSIVE'
                ? reason
                : 'The independent Review still observed the targeted condition.',
        },
      })
      if (claimed.count !== 1) return false
      if (target && outcome === 'IMPROVED') {
        // Targeted runs skip the broad report diff. Their exact repair proof
        // must still resolve the source Flag alongside the verified attempt.
        if (target.kind === 'OUTCOME') await tx.flag.updateMany({
          where: { id: occurrence.flagId, auditId: sourceAuditId,
            audit: { projectId: verificationAudit.projectId }, status: { in: ['OPEN', 'REGRESSED'] } },
          data: { status: 'FIXED', resolvedInId: input.verificationAuditId },
        })
        if (target.kind === 'DIAGNOSTIC') {
          const liveSources = await tx.flag.findMany({ where: {
            id: { in: selectedIds?.length ? selectedIds : [occurrence.flagId] },
            improvementOccurrence: { improvementId: occurrence.improvementId },
            audit: { projectId }, status: { in: ['OPEN', 'REGRESSED'] },
          }, select: repairSourceSelect })
          const recoveredIds = liveSources.filter(flag => {
            const decision = assessSource(flag)
            return decision.comparable && decision.verdict === 'passed'
          }).map(flag => flag.id)
          if (recoveredIds.length) await tx.flag.updateMany({ where: { id: { in: recoveredIds }, audit: { projectId },
            status: { in: ['OPEN', 'REGRESSED'] } }, data: { status: 'FIXED', resolvedInId: input.verificationAuditId } })
        }
        if (target.kind === 'DIAGNOSTIC' && verificationAudit.startedAt) {
          const unresolvedWhere: Prisma.FlagWhereInput = {
            improvementOccurrence: { improvementId: occurrence.improvementId }, audit: { projectId: verificationAudit.projectId },
            source: 'DETERMINISTIC', status: { in: ['OPEN', 'REGRESSED'] }, createdAt: { lte: verificationAudit.startedAt },
          }
          let after: string | undefined
          // Unresolved gaps stay open without preventing later comparable
          // captures from recovering. Keyset traversal survives those updates.
          for (;;) {
            const unresolved = await tx.flag.findMany({ where: { ...unresolvedWhere, ...(after ? { id: { gt: after } } : {}) },
              take: 100, orderBy: { id: 'asc' }, select: {
                id: true, checkId: true, pageUrl: true, affectedPaths: true, attentionPolicy: true, evidenceTargets: true, verificationRule: true, supportingObservations: true,
              } })
            const recovered = unresolved.filter(recoveryReader.hasRecovery)
            if (recovered.length) await tx.flag.updateMany({ where: { ...unresolvedWhere, id: { in: recovered.map(flag => flag.id) } },
              data: { status: 'FIXED', resolvedInId: input.verificationAuditId } })
            if (unresolved.length < 100) break
            after = unresolved.at(-1)!.id
          }
        }
      }
      if (linkedFailure) {
        await tx.improvementOccurrence.upsert({
          where: { flagId: linkedFailure.id },
          create: {
            improvementId: occurrence.improvementId,
            auditId: input.verificationAuditId,
            flagId: linkedFailure.id,
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
      return { outcome, status, comparable, reason }
    })
    if (!recorded) continue
    const { outcome, status, comparable, reason } = recorded
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
