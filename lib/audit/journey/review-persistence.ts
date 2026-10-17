import { executionWrite, currentExecutionOwnership } from '@/lib/audit/execution-ownership'
import { outcomeFlagFingerprint, durableCheckId, baseCheckId } from '../flag-identity'
import { newAiObservationFingerprint } from '../ai-observation-identity'
import { observationsForFlag, mergeSupportingObservations } from '../flag-observations'
import { parseEvidenceTargets } from '../evidence-targets'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { journeyFindingIdentity } from './finding-identity'
import { prisma } from '@/lib/db'
import type { ImpactTag, Prisma, RubricName, Severity } from '@prisma/client'
import { parseActionTimeline, type ActionTimelineEvent } from '@/lib/audit/action-timeline'
import type { JourneyFindingDraft } from './types'
import { scopedOverlayRule, OVERLAY_VERIFICATION_RULE } from '../checks/overlay-evidence'
import { JOURNEY_VERIFICATION_RULE, projectedJourneyFinding } from '../checks/journey-evidence'
import { omitRepeatedCustomerFindings, type JourneyReviewDraft } from './review-findings'

async function mergeActionTimeline(
  auditId: string,
  events: ActionTimelineEvent[] | undefined
): Promise<void> {
  if (!events?.length) return
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { performanceData: true },
  })
  const existing = parseActionTimeline(audit?.performanceData)
  const merged = [...existing, ...events].slice(0, 80)
  const base =
    audit?.performanceData &&
    typeof audit.performanceData === 'object' &&
    !Array.isArray(audit.performanceData)
      ? (audit.performanceData as Record<string, unknown>)
      : {}
  await executionWrite(tx => tx.audit.update({
    where: { id: auditId },
    data: {
      performanceData: { ...base, actionTimeline: merged } as unknown as Prisma.InputJsonValue,
    },
  }))
}

export async function recordJourneyResult(
  auditId: string,
  result: JourneyReviewDraft,
  filteredFindings: JourneyFindingDraft[],
  boundOutcome?: { outcomeId: string; bindingKey: string },
  deferProjectedFlags = false,
): Promise<JourneyFindingDraft[]> {
  for (const finding of filteredFindings) if (!deferProjectedFlags && scopedOverlayRule(finding.verificationRule) && finding.evidenceTargets?.length) {
    await executionWrite(async tx => {
      const existing = await tx.flag.findFirst({ where: { auditId, checkId: finding.checkId,
        OR: [{ pageUrl: finding.url }, { pageUrl: result.startUrl }] }, orderBy: { createdAt: 'asc' },
        select: { id: true, verificationRule: true, evidenceTargets: true, affectedPaths: true } })
      if (!existing) return
      const previous = Array.isArray(existing.evidenceTargets) ? existing.evidenceTargets : []
      const targets = [...new Map([...previous, ...finding.evidenceTargets ?? []].map(target => [JSON.stringify(target), target])).values()]
      if (!scopedOverlayRule(existing.verificationRule)) targets.push({ kind: 'page', source: 'measured', device: 'desktop',
        label: 'Walkthrough cover with unavailable original control scope', context: 'overlay:unscoped:walkthrough' })
      await tx.flag.update({ where: { id: existing.id }, data: { evidenceTargets: targets as Prisma.InputJsonValue,
        verificationRule: scopedOverlayRule(existing.verificationRule) ? OVERLAY_VERIFICATION_RULE : existing.verificationRule,
        affectedPaths: [...new Set([...(Array.isArray(existing.affectedPaths) ? existing.affectedPaths.filter((value): value is string => typeof value === 'string') : []),
          ...finding.affectedPaths ?? [], finding.url])] } })
    })
  }

  // Every observation survives customer-level grouping, including repeat walks.
  const findingsToPersist = omitRepeatedCustomerFindings([], filteredFindings)
  const findingsToRecord = filteredFindings
  const owner = currentExecutionOwnership()
  const admitted = owner?.taskId ? readExecutionSpec((await prisma.audit.findUnique({
    where: { id: auditId }, select: { executionSpec: true },
  }))?.executionSpec) : null
  const collectedAt = new Date().toISOString()
  const observations = (finding: JourneyFindingDraft) => observationsForFlag({ ...finding, source: finding.source === 'AI' ? 'AI' : 'JOURNEY',
    checkId: finding.conditionId ? baseCheckId(finding.checkId) ?? finding.checkId : durableCheckId(finding.checkId) ?? finding.checkId,
    pageUrl: finding.verificationRule === JOURNEY_VERIFICATION_RULE ? finding.affectedPaths?.[0] ?? finding.url : finding.url,
  }, owner?.taskId ? { auditId, taskId: owner.taskId, collectedAt,
    checkVersion: finding.source === 'AI' ? null : admitted?.checks[baseCheckId(finding.checkId)!] ?? admitted?.checks[durableCheckId(finding.checkId)!] ?? null } : undefined)
  const members = (finding: JourneyFindingDraft) => findingsToRecord.filter(item => journeyFindingIdentity(item) === journeyFindingIdentity(finding))

  const review = await executionWrite(tx => tx.journeyReview.create({
    data: {
      auditId,
      journeyType: result.journeyType,
      startUrl: result.startUrl,
      status: result.status,
      completedSteps: result.steps.length,
      maxSteps: 10,
      goalAchieved: result.goalAchieved,
      blockedReason: result.blockedReason,
      abandonedReason: result.abandonedReason,
      startedAt: new Date(Date.now() - result.durationMs),
      completedAt: new Date(),
      durationMs: result.durationMs,
      plannerInputTokens: result.plannerUsage?.inputTokens ?? 0,
      plannerOutputTokens: result.plannerUsage?.outputTokens ?? 0,
      plannerModel: result.plannerUsage?.model,
      planJson: result.planJson ?? undefined,
      steps: {
        create: result.steps.map((s) => ({
          stepNumber: s.stepNumber,
          actionType: s.actionType,
          actionDetail: (s.actionDetail ?? {}) as object,
          url: s.url,
          screenshotBeforeUrl: s.screenshotBeforeUrl,
          screenshotAfterUrl: s.screenshotAfterUrl,
          accessibilityTree: s.accessibilityTree,
          consoleErrors: s.consoleErrors ?? [],
          networkErrors: s.networkErrors ?? [],
          loadTimeMs: s.loadTimeMs,
          confidence: s.confidence ?? 1,
          reasoning: s.reasoning,
          elementRef: s.elementRef,
          elementDescription: s.elementDescription,
          outcomeMatch: s.outcomeMatch,
          outcomeDetail: s.outcomeDetail,
        })),
      },
      findings: {
        create: findingsToRecord.map((f) => ({
          stepNumber: f.stepNumber,
          url: f.url,
          rubric: f.rubric as RubricName,
          severity: f.severity as Severity,
          impactTag: f.impactTag as ImpactTag,
          problem: f.problem,
          evidence: f.evidence,
          whyItMatters: f.whyItMatters,
          fix: f.fix,
          screenshotUrl: f.screenshotUrl,
          accessibilityEvidence: f.accessibilityEvidence,
          confidence: f.confidence ?? 0.85,
          checkId: f.checkId,
          findingType: f.findingType,
        })),
      },
    },
  }))

  for (const f of findingsToPersist) {
    if (deferProjectedFlags && (scopedOverlayRule(f.verificationRule) || projectedJourneyFinding(f))) continue
    const grouped = members(f)
    // The execution guard locks the Audit before this read, merge and admission.
    // Parallel walks therefore cannot lose an observation or admit the same action twice.
    const saved = await executionWrite(async tx => {
      const candidates = await tx.flag.findMany({
        where: { auditId, ...(boundOutcome ? { fingerprint: outcomeFlagFingerprint(boundOutcome.outcomeId, boundOutcome.bindingKey) } : {}) },
        select: { id: true, source: true, fingerprint: true, checkId: true, problem: true, evidence: true, pageUrl: true },
      })
      const existing = candidates.find(candidate => journeyFindingIdentity(candidate) === journeyFindingIdentity(f))
      if (existing) {
        if (owner?.taskId) {
          const current = await tx.flag.findUniqueOrThrow({ where: { id: existing.id }, select: {
            source: true, checkId: true, pageUrl: true, evidence: true, verificationRule: true,
            evidenceTargets: true, supportingObservations: true,
          } })
          await tx.flag.update({ where: { id: existing.id }, data: { supportingObservations: mergeSupportingObservations([
            observationsForFlag({ ...current, evidenceTargets: parseEvidenceTargets(current.evidenceTargets) }),
            ...grouped.map(observations),
          ]) as Prisma.InputJsonValue } })
        }
        return existing
      }
      return tx.flag.create({ data: {
        auditId, checkId: f.checkId, rubric: f.rubric, severity: f.severity as Severity,
        impactTag: f.impactTag as ImpactTag, problem: f.problem, evidence: f.evidence,
        whyItMatters: f.whyItMatters, fix: f.fix, confidence: f.confidence ?? 0.85,
        source: f.source === 'AI' ? 'AI' : 'JOURNEY',
        supportingObservations: owner?.taskId ? mergeSupportingObservations(grouped.map(observations)) as Prisma.InputJsonValue : undefined,
        verificationRule: f.verificationRule, evidenceTargets: f.evidenceTargets as Prisma.InputJsonValue | undefined,
        affectedPaths: f.affectedPaths,
        pageUrl: f.verificationRule === JOURNEY_VERIFICATION_RULE ? f.affectedPaths?.[0] ?? f.url : f.url,
        fingerprint: boundOutcome && f.checkId.startsWith('journey-checkout-failed-')
          ? outcomeFlagFingerprint(boundOutcome.outcomeId, boundOutcome.bindingKey)
          : f.source === 'AI' ? newAiObservationFingerprint({ ...f, pageUrl: f.url })
          : f.conditionId && f.checkId.startsWith('journey-funnel-') ? journeyFindingIdentity(f) : `journey:${f.checkId}:${f.url}`,
        position: f.stepNumber,
      } })
    })
    await executionWrite(tx => tx.journeyFinding.updateMany({ where: { journeyReviewId: review.id,
      OR: grouped.map(finding => ({ checkId: finding.checkId, stepNumber: finding.stepNumber, evidence: finding.evidence })),
    }, data: { flagId: saved.id } }))
  }

  await mergeActionTimeline(auditId, result.actionTimeline as ActionTimelineEvent[] | undefined)

  return findingsToRecord
}

