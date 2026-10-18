import { beginPrescriptionUsage } from './prescription-usage'
import { assertPrescriptionScope, prescriptionCommitSchema, prescriptionHash, type PrescriptionScope } from './prescription-scope'
import { TaskFailure } from './progressive/contracts'
import { executionWrite } from '@/lib/audit/execution-ownership'
import { currentExecutionOwnership } from './execution-ownership'
import { prisma } from '@/lib/db'
import { mergePrescriptionResults, flagKeyForRow } from './persist'
import { finalizeAudit } from './finalize'
import { JudgeContractError } from './validate-judge-output'
import { loadAuditScreenshotBase64 } from './load-screenshot-base64'
import type { PageMetadata } from './metadata'
import { logPipelineEvent } from './pipeline-log'
import { remainingAiReportCredits } from './ai-report-entitlement'
import { hasUnlimitedScans } from '@/lib/auth/permissions'
import { PartialPrescriptionError, runPrescriptionWithRetry } from './judge-prescription'
import { loadTechnologyProfile, technologyNamesForPrompt } from './technology-profile'
import { renderedContentMetadata } from './browser/rendered-copy'
import { publicSupportingObservations } from './flag-observations'

export type PrescriptionRunUsage = {
  inputTokens: number
  outputTokens: number
  model: string
  cacheReadTokens: number
  cacheWriteTokens: number
}

const NO_PRESCRIPTION_USAGE: PrescriptionRunUsage = {
  inputTokens: 0, outputTokens: 0, model: '', cacheReadTokens: 0, cacheWriteTokens: 0,
}

function prescriptionUsage(usage: { inputTokens: number; outputTokens: number; model: string; cacheReadTokens?: number; cacheWriteTokens?: number }): PrescriptionRunUsage {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    model: usage.model,
    cacheReadTokens: usage.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
  }
}

/** Run phase-2 prescription on a triage-completed audit and unlock fix prompts. */
export async function runAiReview(auditId: string, deadline?: number, flagKeys?: readonly string[], scope?: PrescriptionScope): Promise<PrescriptionRunUsage> {
  const owner = currentExecutionOwnership()
  if (!owner?.taskId || owner.auditId !== auditId) throw new Error('Prescription requires its execution task')
  if (!scope) throw new TaskFailure('PRESCRIPTION_SCOPE_MISSING', false)
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: {
      flags: { orderBy: { position: 'asc' } },
      rubrics: true,
    },
  })

  if (!audit) throw new Error(`Audit ${auditId} not found`)
  if (audit.aiReviewAt) return NO_PRESCRIPTION_USAGE
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

  if (scope) {
    const receipt = await prisma.auditPipelineEvent.findFirst({ where: { auditId, executionId: owner.taskId,
      event: 'prescription_guidance_committed' }, orderBy: { sequence: 'desc' }, select: { detail: true } })
    const parsed = prescriptionCommitSchema.safeParse(receipt?.detail)
    if (parsed.success && parsed.data.scopeHash === prescriptionHash(scope)) {
      assertPrescriptionScope(scope, audit.flags, new Map(parsed.data.guidance.map(item => [item.id, item.hash])))
      return NO_PRESCRIPTION_USAGE
    }
    assertPrescriptionScope(scope, audit.flags)
  }

  const recordedMetadata = audit.htmlMetadata as PageMetadata | null
  if (!recordedMetadata) throw new TaskFailure('PRESCRIPTION_PRIMARY_METADATA_MISSING', false)
  if (recordedMetadata.renderedCopy !== undefined && !recordedMetadata.renderedCopy?.complete) throw new TaskFailure('PRESCRIPTION_PRIMARY_COPY_INCOMPLETE', false)
  const metadata = renderedContentMetadata(recordedMetadata)
  if (!audit.verdict || audit.score == null) {
    throw new TaskFailure('PRESCRIPTION_ASSESSMENT_MISSING', false)
  }

  const { desktopBase64, mobileBase64 } = await loadAuditScreenshotBase64(auditId)
  if (!desktopBase64) throw new TaskFailure('PRESCRIPTION_PRIMARY_CAPTURE_MISSING', true)

  const techStack = technologyNamesForPrompt(await loadTechnologyProfile(auditId))

  const requested = flagKeys ? [...new Set(flagKeys)] : null
  if (requested?.some(key => !audit.flags.some(flag => flagKeyForRow(flag) === key))) {
    throw new TaskFailure('PRESCRIPTION_FLAGS_MISSING', false)
  }
  const selectedRows = requested ? audit.flags.filter(flag => requested.includes(flagKeyForRow(flag))) : audit.flags
  assertPrescriptionScope(scope, selectedRows)
  const selectedKeys = new Set(selectedRows.map(flag => flagKeyForRow(flag)).filter(Boolean))
  const coversAll = !requested || audit.flags.every(flag => {
    const key = flagKeyForRow(flag)
    return !key || selectedKeys.has(key)
  })
  const existingFlags = selectedRows.map((flag) => {
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
        onAttempt: model => beginPrescriptionUsage(auditId, model),
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
    const cause = error instanceof PartialPrescriptionError ? error.cause : error
    const errorMsg = cause instanceof Error ? cause.message : 'Prescription failed'

    await logPipelineEvent(auditId, {
      stage: 'judging',
      event: 'prescription_failed',
      error: errorMsg,
    })
    if (error instanceof PartialPrescriptionError) {
      await mergePrescriptionResults(auditId, error.partial.output, { rubrics: false, ...(scope ? { scope } : {}) })
    }

    // The durable task owner decides recovery or terminal failure. A failed
    // provider attempt cannot publish a terminal customer state while retrying.
    throw cause
  }

  const evidence = audit.evidenceCoverage as {
    desktopScreenshot?: boolean
    mobileScreenshot?: boolean
    metadata?: boolean
    aiAssessment?: boolean
    desktopPageSpeed?: boolean
    mobilePageSpeed?: boolean
    flowScan?: boolean
  } | null

  await logPipelineEvent(auditId, { stage: 'finalizing', event: 'prescription_persist' })
  if (coversAll) await mergePrescriptionResults(auditId, prescription.output, ...(scope ? [{ scope }] : []))
  else await mergePrescriptionResults(auditId, prescription.output, { rubrics: false, ...(scope ? { scope } : {}) })

  // A partial batch must not stamp aiReviewAt. That stamp would stop every sibling batch.
  if (coversAll) await finalizeAudit({
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
      desktopScreenshot: evidence?.desktopScreenshot === true,
      mobileScreenshot: evidence?.mobileScreenshot === true,
      metadata: evidence?.metadata === true,
      aiAssessment: evidence?.aiAssessment === true,
      desktopPageSpeed: evidence?.desktopPageSpeed === true,
      mobilePageSpeed: evidence?.mobilePageSpeed === true,
      flowScan: evidence?.flowScan === true,
    },
  })
  return prescriptionUsage(prescription.usage)
}
