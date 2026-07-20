import { prisma } from '@/lib/db'
import { mergePrescriptionResults, flagKeyForRow } from './persist'
import { tryResolveEvidenceAnchorsForAudit } from './persist-evidence-anchors'
import { finalizeAudit } from './finalize'
import { PIPELINE_PROGRESS } from './progress'
import { JudgeContractError } from './validate-judge-output'
import { loadAuditScreenshotBase64 } from './load-screenshot-base64'
import type { PageMetadata } from './metadata'
import { logPipelineEvent } from './pipeline-log'
import { remainingAiReportCredits } from './ai-report-entitlement'
import { hasUnlimitedScans } from '@/lib/auth/permissions'
import { runPrescriptionWithRetry } from './judge-prescription'
import { isRetryableJudgeError } from './judge'
import { enqueueAiReview } from './enqueue-ai-review'

/** Run phase-2 prescription on a triage-completed audit and unlock fix prompts. */
export async function runAiReview(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: {
      flags: { orderBy: { position: 'asc' } },
      rubrics: true,
      pages: { take: 1, orderBy: { url: 'asc' } },
    },
  })

  if (!audit) throw new Error(`Audit ${auditId} not found`)
  if (audit.aiReviewAt) return
  if (!audit.triageAt) {
    throw new Error(`Audit ${auditId} has not completed triage`)
  }
  if (audit.status !== 'COMPLETED' && audit.status !== 'JUDGING') {
    throw new Error(`Audit ${auditId} is not ready for prescription`)
  }
  if (!audit.userId) {
    throw new Error(`Audit ${auditId} must be claimed before prescription`)
  }

  const user = await prisma.user.findUnique({
    where: { id: audit.userId },
    select: { id: true, role: true, plan: true, auditsUsed: true, auditsLimit: true },
  })
  if (!user) throw new Error('Audit owner not found')
  if (!hasUnlimitedScans(user) && (await remainingAiReportCredits(user)) <= 0) {
    throw new Error('AI report limit reached')
  }

  const metadata = audit.htmlMetadata as PageMetadata | null
  if (!metadata) throw new Error('Audit metadata missing for prescription')
  if (!audit.verdict || audit.score == null) {
    throw new Error('Triage verdict missing for prescription')
  }

  const { desktopBase64, mobileBase64 } = await loadAuditScreenshotBase64(auditId)
  if (!desktopBase64) throw new Error('Desktop screenshot missing for prescription')

  const techStack: string[] = (() => {
    const page = audit.pages[0]
    if (!page) return []
    const perfData = page.performanceData as Record<string, unknown> | null
    if (!perfData?.detectedTech) return []
    const techs = perfData.detectedTech as Array<{ name: string; kind: string; confidence: number }>
    return techs.filter((t) => t.kind === 'framework' || t.kind === 'builder' || t.kind === 'cms' || t.kind === 'hosting').map((t) => t.name)
  })()

  const existingFlags = audit.flags.map((flag) => ({
    flagKey: flagKeyForRow(flag),
    source: flag.source,
    rubric: flag.rubric,
    severity: flag.severity,
    problem: flag.problem,
    checkId: flag.checkId,
  }))

  const startedAt = Date.now()
  await prisma.audit.update({
    where: { id: auditId },
    data: { status: 'JUDGING', progress: PIPELINE_PROGRESS.JUDGING, includeAi: true },
  })
  await logPipelineEvent(auditId, { stage: 'judging', event: 'prescription_started' })

  let prescription
  try {
    prescription = await runPrescriptionWithRetry(
      {
        url: audit.url,
        verdict: audit.verdict,
        score: audit.score,
        metadata,
        techStack,
        existingFlags,
        rubrics: audit.rubrics.map((r) => ({
          name: r.name,
          grade: r.grade ?? 'F',
          score: r.score,
          summary: r.summary ?? '',
        })),
      },
      desktopBase64,
      mobileBase64
    )
  } catch (error) {
    const failureCode =
      error instanceof JudgeContractError ? 'AI_CONTRACT_INVALID' : 'AI_REVIEW_FAILED'
    const errorMsg = error instanceof Error ? error.message : 'Prescription failed'

    await logPipelineEvent(auditId, {
      stage: 'judging',
      event: 'prescription_failed',
      error: errorMsg,
    })

    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: 'COMPLETED',
        errorMsg,
        failureCode,
        failureStage: 'judging',
      },
    })

    if (isRetryableJudgeError(error)) {
      await enqueueAiReview(auditId, 30_000)
    }

    throw error
  }

  const evidence = audit.evidenceCoverage as {
    desktopPageSpeed?: boolean
    mobilePageSpeed?: boolean
    flowScan?: boolean
  } | null

  await logPipelineEvent(auditId, { stage: 'finalizing', event: 'prescription_persist' })
  await mergePrescriptionResults(auditId, prescription.output)
  await tryResolveEvidenceAnchorsForAudit(
    auditId,
    audit.url,
    audit.flags
      .filter((flag) => flag.checkId)
      .map((flag) => ({
        checkId: flag.checkId!,
        problem: flag.problem,
        evidence: flag.evidence,
      }))
  )

  await finalizeAudit({
    auditId,
    durationMs: Date.now() - startedAt,
    pagespeedCalls: 0,
    usage: {
      inputTokens: prescription.usage.inputTokens,
      outputTokens: prescription.usage.outputTokens,
      model: prescription.usage.model,
      cacheReadTokens: prescription.usage.cacheReadTokens,
      cacheWriteTokens: prescription.usage.cacheWriteTokens,
    },
    evidence: {
      desktopScreenshot: true,
      mobileScreenshot: Boolean(mobileBase64),
      metadata: true,
      aiAssessment: true,
      desktopPageSpeed: evidence?.desktopPageSpeed ?? true,
      mobilePageSpeed: evidence?.mobilePageSpeed ?? true,
      flowScan: evidence?.flowScan ?? Boolean(audit.flowData),
    },
  })
}
