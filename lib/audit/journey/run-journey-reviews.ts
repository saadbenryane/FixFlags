import { prisma } from '@/lib/db'
import type { ImpactTag, RubricName, Severity } from '@prisma/client'
import { getAuditBrowser } from '@/lib/audit/screenshot'
import { logger } from '@/lib/logger'
import { PIPELINE_PROGRESS_SUBSTEP } from '@/lib/audit/progress'
import { logPipelineEvent } from '@/lib/audit/pipeline-log'
import { parseProductContract, type ProductContract } from '@/lib/audit/product-contract'
import { runJourneyTemplate } from './run-template'
import type { JourneyFindingDraft, JourneyType } from './types'

const PAID_JOURNEY_TYPES: JourneyType[] = [
  'first-visit',
  'pricing-evaluation',
  'signup',
  'contact-support',
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

  // Always keep first-visit early when contract is generic or specific.
  const ordered: JourneyType[] = ['first-visit']
  for (const t of preferred) {
    if (!ordered.includes(t)) ordered.push(t)
  }
  for (const t of base) {
    if (!ordered.includes(t)) ordered.push(t)
  }
  return ordered
}

export async function persistJourneyResult(
  auditId: string,
  result: Awaited<ReturnType<typeof runJourneyTemplate>>
): Promise<JourneyFindingDraft[]> {
  const review = await prisma.journeyReview.create({
    data: {
      auditId,
      journeyType: result.journeyType,
      startUrl: result.startUrl,
      status: result.status,
      completedSteps: result.steps.length,
      maxSteps: 10,
      goalAchieved: result.goalAchieved,
      abandonedReason: result.abandonedReason,
      startedAt: new Date(Date.now() - result.durationMs),
      completedAt: new Date(),
      durationMs: result.durationMs,
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
        })),
      },
      findings: {
        create: result.findings.map((f) => ({
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
        })),
      },
    },
  })

  for (const f of result.findings) {
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

  return result.findings
}

export async function runJourneyReviewsForAudit(
  auditId: string,
  startUrl: string,
  options: { included: boolean; deadline: number }
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

  for (const journeyType of journeyTypes) {
    if (Date.now() >= options.deadline - 8_000) break
    try {
      const result = await runJourneyTemplate(browser, {
        auditId,
        startUrl,
        journeyType,
        deadlineMs: Date.now() + Math.min(JOURNEY_BUDGET_MS, remaining()),
      })
      const findings = await persistJourneyResult(auditId, result)
      findingCount += findings.length
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
