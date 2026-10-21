import { beginProviderUsage, type ProviderUsageAdmission, type ProviderUsagePhase } from '../provider-usage'
import { executionWrite } from '@/lib/audit/execution-ownership'
import { prisma } from '@/lib/db'
import { getAuditBrowser } from '@/lib/audit/screenshot'
import { logger } from '@/lib/logger'
import { PIPELINE_PROGRESS_SUBSTEP } from '@/lib/audit/progress'
import { logPipelineEvent } from '@/lib/audit/pipeline-log'
import { parseProductContract } from '@/lib/audit/product-contract'
import type { PageMetadata } from '@/lib/audit/metadata'
import { detectPagePurpose } from '@/lib/audit/page-purpose'
import { planJourney, isPlannerProviderConfigured } from './planner'
import { evaluateJourney } from './evaluator'
import { assessJourneyEvaluation, type JourneyAssessment } from './evaluation-grounding'
import { createJourneyAIGuard } from './ai-guard'
import { runJourneyTemplate } from './run-template'
import type { JourneyFindingDraft } from './types'
import type { OverlayObservation, OverlayTarget } from '../checks/overlay-evidence'
import { projectedJourneyFinding, readJourneyContext, type JourneyObservation } from '../checks/journey-evidence'
import { selectJourneyRuns } from './review-scope'
import { convertEvaluationToFindings, prepareJourneyFindings, type JourneyReviewDraft } from './review-findings'
import { recordJourneyResult } from './review-persistence'
import { observeJourneyPlan } from './plan-observation'

// Keep existing callers on their established API while each responsibility has one owner.
export { orderJourneysFromContract } from './review-scope'
export { shouldKeepBrokenPromise, convertEvaluationToFindings, omitRepeatedCustomerFindings } from './review-findings'

const JOURNEY_BUDGET_MS = 55_000

export async function persistJourneyResult(auditId: string, result: JourneyReviewDraft,
  boundOutcome?: { outcomeId: string; bindingKey: string }, allowedCheckIds?: readonly string[], deferProjectedFlags = false) {
  return recordJourneyResult(auditId, result, prepareJourneyFindings(result, allowedCheckIds), boundOutcome, deferProjectedFlags)
}

export async function runJourneyReviewsForAudit(
  auditId: string,
  startUrl: string,
  options: { included: boolean; deadline: number; scanAccess?: import('@/lib/audit/scan-access').ScanAccessConfig | null;
    overlayExpectedTargets?: OverlayTarget[]; overlayPhases?: string[]; allowedCheckIds?: readonly string[];
    expectedJourneyConditions?: Array<NonNullable<ReturnType<typeof readJourneyContext>>>;
    recordedJourneyConditions?: Array<NonNullable<ReturnType<typeof readJourneyContext>>>;
    onAssessment?: (assessment: JourneyAssessment) => void;
    onPageObservations?: (observations: JourneyObservation[]) => void;
    onJourneyFindings?: (findings: JourneyFindingDraft[]) => void;
    onOverlayObservations?: (observations: OverlayObservation[]) => void }
): Promise<number> {
  if (!options.included) return 0

  await executionWrite(tx => tx.audit.update({
    where: { id: auditId },
    data: { progress: PIPELINE_PROGRESS_SUBSTEP.JOURNEY_START },
  }))
  await logPipelineEvent(auditId, {
    stage: 'JOURNEY_REVIEW',
    event: 'started',
  })

  const auditRow = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { productContract: true, userId: true, htmlMetadata: true },
  })
  const contract = parseProductContract(auditRow?.productContract)
  const metadata =
    auditRow?.htmlMetadata && typeof auditRow.htmlMetadata === 'object'
      ? (auditRow.htmlMetadata as unknown as PageMetadata)
      : null
  const purpose = metadata ? detectPagePurpose(metadata, startUrl).purpose : null
  const journeyRuns = selectJourneyRuns(contract, purpose, options)

  const browser = await getAuditBrowser()
  let findingCount = 0
  const remaining = () => Math.max(5_000, options.deadline - Date.now())
  const aiGuard = createJourneyAIGuard()
  let usageUnknown = false
  const admitUsage = (phase: ProviderUsagePhase): ProviderUsageAdmission => async model => {
    const permission = aiGuard.canCall(4_000)
    if (usageUnknown || !permission.allowed) throw new Error(`Journey provider admission refused: ${usageUnknown ? 'usage unknown' : permission.reason}`)
    const record = await beginProviderUsage(auditId, phase, model)
    return async usage => {
      await record(usage)
      if (usage) aiGuard.tokenBudget.record(usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0), usage.outputTokens)
      else usageUnknown = true
    }
  }

  for (const journeyRun of journeyRuns) {
    const journeyType = journeyRun.journeyType
    if (Date.now() >= options.deadline - 8_000) {
      options.onAssessment?.({ version: 1, journeyType, state: 'INCOMPLETE', reason: 'budget_unavailable', rejections: [] })
      break
    }
    try {
      let plan = null as Awaited<ReturnType<typeof planJourney>>['plan'] | null
      let plannerUsage = null as Awaited<ReturnType<typeof planJourney>>['usage'] | null
      let planningIncomplete: 'provider_failed' | 'budget_unavailable' | null = null
      if (journeyType === 'multi-step-funnel' && isPlannerProviderConfigured()) {
        const planGuard = aiGuard.canCall(4_000)
        if (!planGuard.allowed) {
          planningIncomplete = 'budget_unavailable'
          logger.info('Skipping journey planner', { reason: planGuard.reason, journeyType })
        } else {
        try {
          const planResult = await observeJourneyPlan(startUrl, contract, options.scanAccess,
            () => Math.min(JOURNEY_BUDGET_MS, remaining()), admitUsage('journey_planner'))
          plan = planResult.plan
          plannerUsage = planResult.usage
          logger.info('Journey planner succeeded', { journeyType, goal: plan.goal,
            steps: plan.steps.length, confidence: plan.confidence })
        } catch (err) {
          planningIncomplete = 'provider_failed'
          logger.warn('Journey plan unavailable; collecting native observations separately', {
            journeyType,
            err: String(err),
          })
          aiGuard.recordOutcome(0, 0, err)
        }
        if (plan) aiGuard.recordOutcome(0, 0, plannerUsage ? undefined : new Error('Provider usage unavailable'))
        }
      }

      const result = await runJourneyTemplate(browser, {
        auditId,
        startUrl,
        journeyType,
        deadlineMs: Date.now() + Math.min(JOURNEY_BUDGET_MS, remaining()),
        scanAccess: options.scanAccess,
        plan,
        plannerUsage: plannerUsage ?? undefined,
        overlayExpectedTargets: options.overlayExpectedTargets?.filter(target => target.context.split(':')[3].startsWith('journey_' + journeyType.replaceAll('-', '_') + '_')),
        expectedJourneyRoute: journeyRun.route,
        journeyPageOnly: Boolean(options.expectedJourneyConditions),
      })
      if (plan) {
        result.planJson = JSON.stringify(plan)
      }
      options.onOverlayObservations?.(result.overlayObservations ?? [])
      options.onPageObservations?.(result.pageObservations ?? [])
      options.onJourneyFindings?.(result.findings.filter(projectedJourneyFinding).map(finding => ({ ...finding, affectedPaths: finding.affectedPaths ?? [result.startUrl] })))
      const findings = await persistJourneyResult(auditId, result, undefined, options.allowedCheckIds, Boolean(options.onOverlayObservations || options.onPageObservations))
      findingCount += findings.length

      if (planningIncomplete || result.blockedReason || result.status !== 'COMPLETED' || (journeyType === 'multi-step-funnel' && result.steps.length < 3)) {
        options.onAssessment?.({ version: 1, journeyType, state: 'INCOMPLETE', reason: planningIncomplete ?? 'walk_incomplete', rejections: [] })
        await logPipelineEvent(auditId, { stage: 'JOURNEY_REVIEW', event: 'assessment_partial', status: 'partial',
          detail: `${journeyType}: ${planningIncomplete ?? result.blockedReason ?? result.status}; recorded observations retained` })
      }

      if (journeyType === 'multi-step-funnel' && !planningIncomplete && result.status === 'COMPLETED' && result.steps.length >= 3 && !result.blockedReason) {
        const evalGuard = aiGuard.canCall(4_000)
        if (!evalGuard.allowed) {
          options.onAssessment?.({ version: 1, journeyType, state: 'INCOMPLETE', reason: 'budget_unavailable', rejections: [] })
          await logPipelineEvent(auditId, { stage: 'JOURNEY_REVIEW', event: 'assessment_partial', status: 'partial', detail: `${journeyType}: evaluator budget unavailable` })
          logger.info('Skipping journey evaluator', { reason: evalGuard.reason, journeyType })
        } else {
        try {
          const evalResult = await evaluateJourney(
            {
              url: startUrl,
              journeyType,
              goalAchieved: result.goalAchieved,
              steps: result.steps,
              summary: result.abandonedReason ?? `Completed ${result.steps.length} steps`,
              purpose,
            },
            Math.min(JOURNEY_BUDGET_MS, remaining()),
            admitUsage('journey_evaluator')
          )
          const assessed = assessJourneyEvaluation(evalResult.evaluation, result.steps, journeyType)
          options.onAssessment?.(assessed.assessment)
          if (assessed.assessment.state === 'INCOMPLETE') await logPipelineEvent(auditId, {
            stage: 'JOURNEY_REVIEW', event: 'assessment_partial', status: 'partial',
            detail: `${journeyType}: ${assessed.assessment.rejections.length} unsupported candidates; ${assessed.assessment.rejections.map(item => item.reason).join(', ')}`,
          })
          const evalFindings = convertEvaluationToFindings(
            assessed.evaluation,
            result.steps,
            startUrl,
            purpose
          )
          if (evalFindings.length > 0) {
            const persisted = await persistJourneyResult(auditId, {
              ...result,
              findings: evalFindings,
              journeyType,
            }, undefined, options.allowedCheckIds)
            findingCount += persisted.length
          }
          const evaluatorUsage = evalResult.usage
          if (evaluatorUsage) await executionWrite(tx => tx.journeyReview.updateMany({
            where: { auditId, journeyType },
            data: {
              evaluatorInputTokens: evaluatorUsage.inputTokens,
              evaluatorOutputTokens: evaluatorUsage.outputTokens,
              evaluatorModel: evaluatorUsage.model,
            },
          }))
          aiGuard.recordOutcome(0, 0, evalResult.usage ? undefined : new Error('Provider usage unavailable'))
        } catch (err) {
          options.onAssessment?.({ version: 1, journeyType, state: 'INCOMPLETE', reason: 'provider_failed', rejections: [] })
          await logPipelineEvent(auditId, { stage: 'JOURNEY_REVIEW', event: 'assessment_partial', status: 'partial', detail: `${journeyType}: evaluator failed; native observations retained` })
          logger.warn('Journey evaluator failed', { journeyType, err: String(err) })
          aiGuard.recordOutcome(0, 0, err)
        }
        }
      }
    } catch (err) {
      options.onAssessment?.({ version: 1, journeyType, state: 'INCOMPLETE', reason: 'walk_incomplete', rejections: [] })
      logger.error('Journey review failed', { journeyType, err })
    }
  }

  await executionWrite(tx => tx.audit.update({
    where: { id: auditId },
    data: { journeyReviewAt: new Date(), progress: PIPELINE_PROGRESS_SUBSTEP.JOURNEY_DONE },
  }))
  await logPipelineEvent(auditId, {
    stage: 'JOURNEY_REVIEW',
    event: 'completed',
    detail: `${findingCount} findings`,
  })

  return findingCount
}
