import { AuditDeadlineError } from '../pipeline-errors'
import { finalizePartialAudit, persistAuditFailedModules } from '../finalize'
import { deriveAuditFailure } from './failure'
import type { TriageResult } from '../judge-triage'
import type { PipelineContext, PageRun } from './types'

/** Strip URLs, API keys, and config-looking tokens out of an error before it is persisted. */
export function sanitizeAuditErrorMessage(message: string): string {
  return message
    .replace(/https?:\/\/[^\s]+/gi, '[url]')
    .replace(/\bsk-[a-zA-Z0-9_*-]{8,}\b/g, '[redacted-key]')
    .replace(/\bsk-ant-[a-zA-Z0-9_*-]{8,}\b/g, '[redacted-key]')
    .replace(/:\s*sk-[a-zA-Z0-9_*-]+/g, ': [redacted-key]')
    .replace(/\b[A-Z][A-Z0-9_]{2,}\b/g, (match) =>
      match.includes('API') || match.includes('KEY') ? '[config]' : match
    )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

/** Throw if the audit has exceeded its end-to-end deadline. */
export function assertDeadline(ctx: PipelineContext, stage: string): void {
  if (Date.now() > ctx.deadline) {
    throw new AuditDeadlineError(stage)
  }
}

/** Fold a triage call's token usage into the run-level totals. */
export function accumulateTriageUsage(ctx: PipelineContext, triage: TriageResult): void {
  ctx.usage.inputTokens += triage.usage.inputTokens
  ctx.usage.outputTokens += triage.usage.outputTokens
  ctx.usage.cacheReadTokens = (ctx.usage.cacheReadTokens ?? 0) + (triage.usage.cacheReadTokens ?? 0)
  ctx.usage.cacheWriteTokens =
    (ctx.usage.cacheWriteTokens ?? 0) + (triage.usage.cacheWriteTokens ?? 0)
  if (!ctx.usage.models.includes(triage.usage.model)) {
    ctx.usage.models.push(triage.usage.model)
  }
}

/**
 * When the pipeline fails after at least one page has captured evidence, finalize
 * with the deterministic results we already have instead of failing the whole run.
 * Returns true if a partial report was written.
 */
export async function tryPartialFinalize(
  ctx: PipelineContext,
  pageRuns: PageRun[],
  error: unknown
): Promise<boolean> {
  if (pageRuns.length === 0) return false
  const hasEvidence = pageRuns.every((p) => p.desktopScreenshot)
  if (!hasEvidence) return false

  const errorMsg = sanitizeAuditErrorMessage(
    error instanceof Error ? error.message : String(error)
  )
  const { failureCode, failureStage } = deriveAuditFailure(
    error,
    pageRuns.some((p) => p.triage) ? 'judging' : 'checking'
  )

  // Keep the partial report honest: check modules that threw before the
  // pipeline error are still surfaced to the user.
  await persistAuditFailedModules(ctx.auditId, pageRuns)

  await finalizePartialAudit({
    auditId: ctx.auditId,
    durationMs: Date.now() - ctx.startedAt.getTime(),
    pagespeedCalls: ctx.pagespeedCalls,
    usage: {
      inputTokens: ctx.usage.inputTokens,
      outputTokens: ctx.usage.outputTokens,
      model: ctx.usage.models.join(',') || 'none',
    },
    evidence: {
      desktopScreenshot: pageRuns.every((p) => p.desktopScreenshot),
      mobileScreenshot: pageRuns.every((p) => p.mobileScreenshot),
      metadata: pageRuns.every((p) => Boolean(p.metadata)),
      desktopPageSpeed: pageRuns.every((p) => Boolean(p.desktop)),
      mobilePageSpeed: pageRuns.every((p) => Boolean(p.mobile)),
    },
    failureCode,
    failureStage,
    errorMsg,
  })
  return true
}
