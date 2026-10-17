import { executionWrite } from '@/lib/audit/execution-ownership'
import { currentExecutionOwnership } from './execution-ownership'
import { prisma } from '@/lib/db'
import { mergePrescriptionResults, flagKeyForRow } from './persist'
import { finalizeAudit } from './finalize'
import { PIPELINE_PROGRESS } from './progress'
import { JudgeContractError } from './validate-judge-output'
import { loadAuditScreenshotBase64 } from './load-screenshot-base64'
import type { PageMetadata } from './metadata'
import { logPipelineEvent } from './pipeline-log'
import { remainingAiReportCredits } from './ai-report-entitlement'
import { hasUnlimitedScans } from '@/lib/auth/permissions'
import { runPrescriptionWithRetry } from './judge-prescription'
import { loadTechnologyProfile, technologyNamesForPrompt } from './technology-profile'
import { renderedContentMetadata } from './browser/rendered-copy'
import { publicSupportingObservations } from './flag-observations'

/** Run phase-2 prescription on a triage-completed audit and unlock fix prompts. */
export async function runAiReview(auditId: string, deadline?: number): Promise<void> {
  const owner = currentExecutionOwnership()
  if (!owner?.taskId || owner.auditId !== auditId) throw new Error('Prescription requires its execution task')
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: {
      flags: { orderBy: { position: 'asc' } },
      rubrics: true,
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

  const recordedMetadata = audit.htmlMetadata as PageMetadata | null
  if (!recordedMetadata) throw new Error('Audit metadata missing for prescription')
  if (recordedMetadata.renderedCopy !== undefined && !recordedMetadata.renderedCopy?.complete) throw new Error('Rendered page copy could not be observed.')
  const metadata = renderedContentMetadata(recordedMetadata)
  if (!audit.verdict || audit.score == null) {
    throw new Error('Triage verdict missing for prescription')
  }

  const { desktopBase64, mobileBase64 } = await loadAuditScreenshotBase64(auditId)
  if (!desktopBase64) throw new Error('Desktop screenshot missing for prescription')

  const techStack = technologyNamesForPrompt(await loadTechnologyProfile(auditId))

  const existingFlags = audit.flags.map((flag) => {
    const supportingObservations = publicSupportingObservations(flag.supportingObservations)
    if (flag.supportingObservations != null && !supportingObservations.length)
      throw new JudgeContractError('Recorded supporting observations could not be read for prescription')
    return {
      flagKey: flagKeyForRow(flag),
      source: flag.source,
      rubric: flag.rubric,
      severity: flag.severity,
      problem: flag.problem,
      checkId: flag.checkId,
      evidence: flag.evidence,
      whyItMatters: flag.whyItMatters,
      verificationRule: flag.verificationRule,
      pageUrl: flag.pageUrl,
      supportingObservations,
    }
  })

  const { verdict, score } = audit
  if (verdict == null || score == null) throw new Error('A recorded assessment is required before preparing this explanation')
  const startedAt = Date.now()
  await executionWrite(tx => tx.audit.update({
    where: { id: auditId },
    // Prescription enriches an already completed report. Its lease and events
    // track execution without reopening the analysis or its monitoring run.
    data: { includeAi: true },
  }))
  await logPipelineEvent(auditId, { stage: 'judging', event: 'prescription_started' })

  let prescription
  try {
    prescription = await runPrescriptionWithRetry(
      {
        url: audit.url,
        verdict,
        score,
        metadata,
        techStack,
        existingFlags,
        rubrics: audit.rubrics.map((r) => ({
          name: r.name,
          grade: r.grade,
          score: r.score,
          summary: r.summary ?? '',
        })),
      },
      desktopBase64,
      mobileBase64,
      deadline === undefined ? undefined : Math.max(1, deadline - Date.now() - 5000)
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

    await executionWrite(tx => tx.audit.update({
      where: { id: auditId },
      data: {
        status: 'COMPLETED',
        progress: PIPELINE_PROGRESS.COMPLETED,
        errorMsg,
        failureCode,
        failureStage: 'judging',
      },
    }))

    throw error
  }

  const evidence = audit.evidenceCoverage as {
    desktopPageSpeed?: boolean
    mobilePageSpeed?: boolean
    flowScan?: boolean
  } | null

  await logPipelineEvent(auditId, { stage: 'finalizing', event: 'prescription_persist' })
  await mergePrescriptionResults(auditId, prescription.output)

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
      desktopPageSpeed: evidence?.desktopPageSpeed === true,
      mobilePageSpeed: evidence?.mobilePageSpeed === true,
      flowScan: evidence?.flowScan === true,
    },
  })
}
