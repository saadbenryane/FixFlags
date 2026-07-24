import { prisma } from '@/lib/db'
import type { ImpactTag, Prisma, RubricName, Severity } from '@prisma/client'
import { getAuditBrowser } from '@/lib/audit/screenshot'
import { logger } from '@/lib/logger'
import { PIPELINE_PROGRESS_SUBSTEP } from '@/lib/audit/progress'
import { logPipelineEvent } from '@/lib/audit/pipeline-log'
import { parseProductContract, type ProductContract } from '@/lib/audit/product-contract'
import { parseActionTimeline, type ActionTimelineEvent } from '@/lib/audit/action-timeline'
import { runNetworkEngagementChecks } from '@/lib/audit/checks/network-engagement'
import { filterToolingPathFlags } from '@/lib/audit/tooling-path-filter'
import { captureAccessibilityTree } from '@/lib/audit/browser/journey-safety'
import { discoverJourneyLinks } from './discover'
import { planJourney, isPlannerProviderConfigured } from './planner'
import { evaluateJourney } from './evaluator'
import type { JourneyEvaluation } from './evaluator-schema'
import { createJourneyAIGuard } from './ai-guard'
import { runJourneyTemplate } from './run-template'
import type { JourneyFindingDraft, JourneyStepDraft, JourneyType } from './types'

const PAID_JOURNEY_TYPES: JourneyType[] = [
  'first-visit',
  'pricing-evaluation',
  'signup',
  'contact-support',
  'multi-step-funnel',
]

const JOURNEY_BUDGET_MS = 55_000

/** Prefer journey templates that match the Product Contract first-value path. */
export function orderJourneysFromContract(contract: ProductContract | null): JourneyType[] {
  const base = [...PAID_JOURNEY_TYPES]
  if (!contract) return base

  const text =
    `${contract.firstValueJourney} ${contract.purpose} ${contract.criticalOutcomes.join(' ')}`.toLowerCase()
  const preferred: JourneyType[] = []
  if (/pric|plan|checkout|buy|purchas/.test(text)) preferred.push('pricing-evaluation')
  if (/sign.?up|register|trial|onboard|account/.test(text)) preferred.push('signup')
  if (/contact|support|help|demo/.test(text)) preferred.push('contact-support')

  const ordered: JourneyType[] = ['first-visit']
  for (const t of preferred) {
    if (!ordered.includes(t)) ordered.push(t)
  }
  for (const t of base) {
    if (!ordered.includes(t)) ordered.push(t)
  }
  return ordered
}

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
  await prisma.audit.update({
    where: { id: auditId },
    data: {
      performanceData: { ...base, actionTimeline: merged } as unknown as Prisma.InputJsonValue,
    },
  })
}

function withStepEvidence(f: JourneyFindingDraft): JourneyFindingDraft {
  if (/reproduced at step/i.test(f.evidence)) return f
  return {
    ...f,
    evidence: `Reproduced at step ${f.stepNumber}. ${f.evidence}`,
  }
}

function convertEvaluationToFindings(
  evaluation: JourneyEvaluation,
  steps: JourneyStepDraft[],
  startUrl: string
): JourneyFindingDraft[] {
  const findings: JourneyFindingDraft[] = []

  for (const fp of evaluation.frictionPoints) {
    const step = steps.find((s) => s.stepNumber === fp.stepNumber)
    findings.push({
      checkId: `journey-funnel-${fp.type}`,
      stepNumber: fp.stepNumber,
      url: step?.url ?? startUrl,
      rubric: fp.rubric,
      severity: fp.severity,
      impactTag: fp.impactTag,
      problem: fp.description,
      evidence: fp.evidence,
      whyItMatters:
        fp.type === 'hesitation'
          ? 'Hesitation signals indicate uncertainty that causes visitors to abandon.'
          : fp.type === 'confusion'
            ? 'Confused visitors cannot find the path forward and leave.'
            : fp.type === 'too-many-steps'
              ? 'Long funnels have compounding drop-off at each step.'
              : fp.type === 'unclear-progress'
                ? 'Visitors lose context when they cannot tell where they are in the flow.'
                : 'Missing feedback after actions makes visitors uncertain whether anything happened.',
      fix: '1. Review this step in the journey\n2. Add clearer visual feedback\n3. Reduce cognitive load at this point',
      screenshotUrl: step?.screenshotAfterUrl,
      accessibilityEvidence: step?.accessibilityTree?.slice(0, 2000),
      confidence: evaluation.confidence,
      findingType: 'friction',
    })
  }

  for (const bp of evaluation.brokenPromises) {
    const step = steps.find((s) => s.stepNumber === bp.stepNumber)
    findings.push({
      checkId: 'journey-funnel-broken-promise',
      stepNumber: bp.stepNumber,
      url: step?.url ?? startUrl,
      rubric: 'MESSAGE',
      severity: bp.severity,
      impactTag: 'TRUST',
      problem: `Broken promise: expected "${bp.expected}" but got "${bp.actual}"`,
      evidence: bp.evidence,
      whyItMatters: 'Broken promises erode trust and cause immediate abandonment.',
      fix: '1. Align page content with what was promised in the previous step\n2. Ensure headlines, CTAs, and page content tell a consistent story\n3. Remove misleading claims',
      screenshotUrl: step?.screenshotAfterUrl,
      accessibilityEvidence: step?.accessibilityTree?.slice(0, 2000),
      confidence: evaluation.confidence,
      findingType: 'broken-promise',
    })
  }

  for (const ab of evaluation.accessibilityBarriers) {
    const step = steps.find((s) => s.stepNumber === ab.stepNumber)
    findings.push({
      checkId: 'journey-funnel-accessibility-barrier',
      stepNumber: ab.stepNumber,
      url: step?.url ?? startUrl,
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
      impactTag: 'ACCESSIBILITY',
      problem: ab.barrier,
      evidence: ab.evidence,
      whyItMatters: 'Accessibility barriers prevent users with disabilities from completing the journey.',
      fix: '1. Ensure all interactive elements are keyboard-accessible\n2. Add proper ARIA labels and roles\n3. Test with screen readers',
      screenshotUrl: step?.screenshotAfterUrl,
      accessibilityEvidence: step?.accessibilityTree?.slice(0, 2000),
      confidence: evaluation.confidence,
      findingType: 'accessibility-barrier',
    })
  }

  return findings
}

export async function persistJourneyResult(
  auditId: string,
  result: Awaited<ReturnType<typeof runJourneyTemplate>>
): Promise<JourneyFindingDraft[]> {
  const filteredFindings = filterToolingPathFlags(result.findings.map(withStepEvidence))
  const findingsToPersist = [...filteredFindings]

  const networkFlags = runNetworkEngagementChecks([], result.formProbe)
  for (const nf of networkFlags) {
    if (findingsToPersist.some((f) => f.checkId === nf.checkId)) continue
    findingsToPersist.push(
      withStepEvidence({
        checkId: nf.checkId,
        stepNumber: result.steps.length || 1,
        url: result.startUrl,
        rubric: 'EXPERIENCE',
        severity: nf.severity as JourneyFindingDraft['severity'],
        impactTag: (nf.impactTag ?? 'CONVERSION') as JourneyFindingDraft['impactTag'],
        problem: nf.problem,
        evidence: nf.evidence,
        whyItMatters: 'Engagement paths that fail at the API layer lose conversions.',
        fix: nf.fix,
        confidence: nf.confidence,
      })
    )
  }

  const review = await prisma.journeyReview.create({
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
        create: findingsToPersist.map((f) => ({
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
  })

  for (const f of findingsToPersist) {
    const created = await prisma.flag.create({
      data: {
        auditId,
        checkId: f.checkId,
        rubric: f.rubric,
        severity: f.severity as Severity,
        impactTag: f.impactTag as ImpactTag,
        problem: f.problem,
        evidence: f.evidence,
        whyItMatters: f.whyItMatters,
        fix: f.fix,
        confidence: f.confidence ?? 0.85,
        source: 'JOURNEY',
        pageUrl: f.url,
        fingerprint: `journey:${f.checkId}:${f.url}`,
        position: f.stepNumber,
      },
    })
    await prisma.journeyFinding.updateMany({
      where: { journeyReviewId: review.id, checkId: f.checkId, stepNumber: f.stepNumber },
      data: { flagId: created.id },
    })
  }

  await mergeActionTimeline(auditId, result.actionTimeline as ActionTimelineEvent[] | undefined)

  return findingsToPersist
}

export async function runJourneyReviewsForAudit(
  auditId: string,
  startUrl: string,
  options: { included: boolean; deadline: number; scanAccess?: import('@/lib/audit/scan-access').ScanAccessConfig | null }
): Promise<number> {
  if (!options.included) return 0

  await prisma.audit.update({
    where: { id: auditId },
    data: { progress: PIPELINE_PROGRESS_SUBSTEP.JOURNEY_START },
  })
  await logPipelineEvent(auditId, {
    stage: 'JOURNEY_REVIEW',
    event: 'started',
  })

  const auditRow = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { productContract: true },
  })
  const contract = parseProductContract(auditRow?.productContract)
  const journeyTypes = orderJourneysFromContract(contract)

  const browser = await getAuditBrowser()
  let findingCount = 0
  const remaining = () => Math.max(5_000, options.deadline - Date.now())
  const aiGuard = createJourneyAIGuard()

  for (const journeyType of journeyTypes) {
    if (Date.now() >= options.deadline - 8_000) break
    try {
      let plan = null as Awaited<ReturnType<typeof planJourney>>['plan'] | null
      let plannerUsage = null as Awaited<ReturnType<typeof planJourney>>['usage'] | null
      if (journeyType === 'multi-step-funnel' && isPlannerProviderConfigured()) {
        const planGuard = aiGuard.canCall(4_000)
        if (!planGuard.allowed) {
          logger.info('Skipping journey planner', { reason: planGuard.reason, journeyType })
        } else {
        try {
          const browserForPlan = await getAuditBrowser()
          const planSession = await (
            await import('@/lib/audit/browser/page-session')
          ).createAuditPage(browserForPlan, startUrl, {
            profile: (await import('@/lib/audit/browser/capture-profile')).DESKTOP_CAPTURE_PROFILE,
            journeySafe: true,
            scanAccess: options.scanAccess,
          })
          try {
            const origin = new URL(startUrl).origin
            const [initialTree, links] = await Promise.all([
              captureAccessibilityTree(planSession.page),
              discoverJourneyLinks(planSession.page, origin),
            ])
            const planResult = await planJourney(
              {
                url: startUrl,
                contract,
                initialTree,
                metadata: {
                  title: await planSession.page.title(),
                  description: await planSession.page.evaluate(
                    () =>
                      document.querySelector('meta[name="description"]')?.getAttribute('content') ?? ''
                  ),
                  h1s: await planSession.page.evaluate(() =>
                    Array.from(document.querySelectorAll('h1'))
                      .map((h) => (h.textContent ?? '').trim())
                      .filter(Boolean)
                  ),
                },
                links,
              },
              Math.min(JOURNEY_BUDGET_MS, remaining())
            )
            plan = planResult.plan
            plannerUsage = planResult.usage
            logger.info('Journey planner succeeded', {
              journeyType,
              goal: plan.goal,
              steps: plan.steps.length,
              confidence: plan.confidence,
            })
          } finally {
            planSession.disposeNetwork()
            await planSession.page.context().close().catch(() => {})
          }
        } catch (err) {
          logger.warn('Journey planner failed, falling back to deterministic', {
            journeyType,
            err: String(err),
          })
          aiGuard.recordOutcome(0, 0, err)
        }
        if (plannerUsage) {
          aiGuard.recordOutcome(plannerUsage.inputTokens, plannerUsage.outputTokens)
        }
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
      })
      if (plan) {
        result.planJson = JSON.stringify(plan)
      }
      const findings = await persistJourneyResult(auditId, result)
      findingCount += findings.length

      if (journeyType === 'multi-step-funnel' && result.steps.length >= 3) {
        const evalGuard = aiGuard.canCall(4_000)
        if (!evalGuard.allowed) {
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
            },
            Math.min(JOURNEY_BUDGET_MS, remaining())
          )
          const evalFindings = convertEvaluationToFindings(
            evalResult.evaluation,
            result.steps,
            startUrl
          )
          if (evalFindings.length > 0) {
            const persisted = await persistJourneyResult(auditId, {
              ...result,
              findings: evalFindings,
              journeyType,
            })
            findingCount += persisted.length
          }
          await prisma.journeyReview.updateMany({
            where: { auditId, journeyType },
            data: {
              evaluatorInputTokens: evalResult.usage.inputTokens,
              evaluatorOutputTokens: evalResult.usage.outputTokens,
              evaluatorModel: evalResult.usage.model,
            },
          })
          aiGuard.recordOutcome(evalResult.usage.inputTokens, evalResult.usage.outputTokens)
        } catch (err) {
          logger.warn('Journey evaluator failed', { journeyType, err: String(err) })
          aiGuard.recordOutcome(0, 0, err)
        }
        }
      }
    } catch (err) {
      logger.error('Journey review failed', { journeyType, err })
    }
  }

  await prisma.audit.update({
    where: { id: auditId },
    data: { journeyReviewAt: new Date(), progress: PIPELINE_PROGRESS_SUBSTEP.JOURNEY_DONE },
  })
  await logPipelineEvent(auditId, {
    stage: 'JOURNEY_REVIEW',
    event: 'completed',
    detail: `${findingCount} findings`,
  })

  return findingCount
}
