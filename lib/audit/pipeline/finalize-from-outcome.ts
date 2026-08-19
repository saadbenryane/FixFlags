import { prisma } from '@/lib/db'
import { logPipelineEvent } from '@/lib/audit/pipeline-log'
import { persistTriageResults } from '@/lib/audit/persist'
import { mergeFlowCtaEvidenceAnchors } from '@/lib/audit/persist-evidence-anchors'
import { tryCaptureVisualEvidenceForAudit } from '@/lib/audit/persist-visual-evidence'
import {
  finalizeTriageAudit,
  finalizeTriageDegraded,
  persistAuditFailedModules,
} from '@/lib/audit/finalize'
import { enqueueAiReview } from '@/lib/audit/enqueue-ai-review'
import { runTriageStep } from '@/lib/audit/pipeline/triage-step'
import { accumulateTriageUsage } from '@/lib/audit/pipeline/context'
import { averageScores, buildCombinedTriageOutput } from '@/lib/audit/pipeline/combine-pages'
import {
  primaryPageRun,
  resolveAuditOutcome,
  type AuditOutcome,
} from '@/lib/audit/pipeline/outcome'
import { parseTriageFailure } from '@/lib/audit/pipeline/triage-failure'
import type { PipelineContext, PageRun } from '@/lib/audit/pipeline/types'

interface FinalizeFromOutcomeInput {
  ctx: PipelineContext
  auditId: string
  auditUrl: string
  pageRuns: PageRun[]
  startedAt: Date
}

function buildEvidence(pageRuns: PageRun[], aiAssessment: boolean) {
  return {
    desktopScreenshot: pageRuns.every((page) => page.desktopScreenshot),
    mobileScreenshot: pageRuns.every((page) => page.mobileScreenshot),
    metadata: pageRuns.every((page) => Boolean(page.metadata)),
    aiAssessment,
    desktopPageSpeed: pageRuns.every((page) => Boolean(page.desktop)),
    mobilePageSpeed: pageRuns.every((page) => Boolean(page.mobile)),
    flowScan: pageRuns.some((page) => page.flowScan),
  }
}

async function persistEvidenceAnchors(
  auditId: string,
  auditUrl: string,
  pageRuns: PageRun[]
): Promise<void> {
  const pageFlags = pageRuns.flatMap((page) =>
    page.flags.map((flag) => ({
      checkId: flag.checkId,
      problem: flag.problem,
      evidence: flag.evidence,
      severity: flag.severity,
      rubric: flag.rubric,
    }))
  )
  const journeyFlags = await prisma.flag.findMany({
    where: { auditId, source: 'JOURNEY', checkId: { not: null } },
    select: {
      checkId: true,
      problem: true,
      evidence: true,
      severity: true,
      rubric: true,
    },
  })
  const seen = new Set(pageFlags.map((f) => f.checkId))
  const allFlags = [
    ...pageFlags,
    ...journeyFlags
      .filter((f): f is typeof f & { checkId: string } => Boolean(f.checkId) && !seen.has(f.checkId!))
      .map((f) => ({
        checkId: f.checkId,
        problem: f.problem,
        evidence: f.evidence,
        severity: f.severity,
        rubric: f.rubric,
      })),
  ]
  const primaryFlow = pageRuns.find((page) => page.flowResult)?.flowResult
  if (primaryFlow) {
    await mergeFlowCtaEvidenceAnchors(auditId, primaryFlow)
  }

  const primary = pageRuns[0]
  const metrics = {
    perfScore: primary?.mobile?.score ?? primary?.desktop?.score ?? null,
  }
  await tryCaptureVisualEvidenceForAudit(
    auditId,
    auditUrl,
    allFlags.map((f) => ({
      checkId: f.checkId,
      severity: f.severity,
      rubric: f.rubric,
    })),
    metrics
  )
}

async function finalizeTriageComplete(
  input: FinalizeFromOutcomeInput,
  pageRuns: PageRun[]
): Promise<void> {
  const { ctx, auditId, auditUrl, startedAt } = input
  const combinedTriage = buildCombinedTriageOutput(pageRuns)
  const flags = pageRuns.flatMap((page) => page.flags)
  const rubricScores = averageScores(pageRuns)

  await logPipelineEvent(auditId, { stage: 'finalizing', event: 'persist_started' })
  await persistTriageResults(auditId, combinedTriage, flags, rubricScores)
  await persistEvidenceAnchors(auditId, auditUrl, pageRuns)

  await finalizeTriageAudit({
    auditId,
    durationMs: Date.now() - startedAt.getTime(),
    pagespeedCalls: ctx.pagespeedCalls,
    usage: {
      inputTokens: ctx.usage.inputTokens,
      outputTokens: ctx.usage.outputTokens,
      model: ctx.usage.models.join(','),
      cacheReadTokens: ctx.usage.cacheReadTokens,
      cacheWriteTokens: ctx.usage.cacheWriteTokens,
    },
    evidence: buildEvidence(pageRuns, true),
  })

  // Claiming can happen while this runner is capturing or checking. Re-read
  // the persisted entitlement so a newly owned report does not miss its
  // prescription job because the runner's initial context is stale.
  const prescriptionState = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { includeAi: true, aiReviewAt: true },
  })
  if (prescriptionState?.includeAi && !prescriptionState.aiReviewAt) {
    await enqueueAiReview(auditId)
  }
}

async function finalizeTriageDegradedOutcome(
  input: FinalizeFromOutcomeInput,
  outcome: Extract<AuditOutcome, { kind: 'triage_degraded' }>
): Promise<void> {
  const { ctx, auditId, auditUrl, startedAt } = input
  await logPipelineEvent(auditId, {
    stage: 'finalizing',
    event: 'triage_degraded',
    detail: outcome.reason,
    error: outcome.message,
  })
  await persistEvidenceAnchors(auditId, auditUrl, outcome.pageRuns)
  await finalizeTriageDegraded({
    auditId,
    durationMs: Date.now() - startedAt.getTime(),
    pagespeedCalls: ctx.pagespeedCalls,
    usage: {
      inputTokens: ctx.usage.inputTokens,
      outputTokens: ctx.usage.outputTokens,
      model: ctx.usage.models.join(','),
    },
    evidence: buildEvidence(outcome.pageRuns, false),
    reason: outcome.reason,
    errorMsg: outcome.message,
  })
}

/** One runner-level retry when primary triage failed for a retryable provider error. */
export async function retryPrimaryTriage(
  ctx: PipelineContext,
  pageRuns: PageRun[]
): Promise<PageRun[]> {
  const primary = primaryPageRun(pageRuns)
  if (!primary || primary.triage || !primary.triageFailure?.retryable) {
    return pageRuns
  }

  await logPipelineEvent(ctx.auditId, {
    stage: 'judging',
    event: 'triage_runner_retry',
    detail: primary.triageFailure.reason,
  })

  try {
    const triageResult = await runTriageStep(ctx, {
      url: primary.url,
      metadata: primary.metadata,
      desktop: primary.desktop,
      mobile: primary.mobile,
      flags: primary.flags,
      desktopBase64: primary.desktopBase64,
      mobileBase64: primary.mobileBase64,
    })
    accumulateTriageUsage(ctx, triageResult)
    triageResult.output.newFlags = triageResult.output.newFlags.map((flag) => ({
      ...flag,
      pageUrl: primary.url,
    }))
    return [{ ...primary, triage: triageResult, triageFailure: undefined }, ...pageRuns.slice(1)]
  } catch (err) {
    const failure = parseTriageFailure(err)
    await logPipelineEvent(ctx.auditId, {
      stage: 'judging',
      event: 'triage_runner_retry_failed',
      error: failure.message,
      detail: failure.reason,
    })
    return [
      { ...primary, triageFailure: failure },
      ...pageRuns.slice(1),
    ]
  }
}

/**
 * Route a resolved audit outcome to the correct finalize path.
 * Returns true when finalize succeeded; false when persist failed mid-triage-complete.
 */
export async function finalizeFromOutcome(input: FinalizeFromOutcomeInput): Promise<boolean> {
  const outcome = resolveAuditOutcome(input.pageRuns)

  // Surface any check modules that threw before the report completes, so
  // "all fixes" never silently loses an entire check area.
  await persistAuditFailedModules(input.auditId, input.pageRuns)

  if (outcome.kind === 'triage_complete') {
    try {
      await finalizeTriageComplete(input, outcome.pageRuns)
      return true
    } catch (err) {
      await logPipelineEvent(input.auditId, {
        stage: 'finalizing',
        event: 'triage_persist_failed',
        error: err instanceof Error ? err.message : String(err),
      })
      await finalizeTriageDegradedOutcome(input, {
        kind: 'triage_degraded',
        pageRuns: input.pageRuns,
        reason: 'unknown',
        message: err instanceof Error ? err.message : String(err),
      })
      return false
    }
  }

  await finalizeTriageDegradedOutcome(input, outcome)
  return true
}
