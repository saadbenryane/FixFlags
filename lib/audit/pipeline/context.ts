import { AuditDeadlineError } from '../pipeline-errors'
import { finalizePartialAudit } from '../finalize'
import { deriveAuditFailure } from './failure'
import type { JudgeResult } from '../judge'
import type { PipelineContext, PageRun } from './types'

/** Strip URLs and config-looking tokens out of an error before it is persisted. */
export function sanitizeAuditErrorMessage(message: string): string {
  return message
    .replace(/https?:\/\/[^\s]+/gi, '[url]')
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

/** Fold a judge call's token usage into the run-level totals. */
export function accumulateUsage(ctx: PipelineContext, judge: JudgeResult): void {
  ctx.usage.inputTokens += judge.usage.inputTokens
  ctx.usage.outputTokens += judge.usage.outputTokens
  if (!ctx.usage.models.includes(judge.usage.model)) {
    ctx.usage.models.push(judge.usage.model)
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
  const hasEvidence = pageRuns.every((p) => p.desktopScreenshot && p.flags.length >= 0)
  if (!hasEvidence) return false

  const errorMsg = sanitizeAuditErrorMessage(
    error instanceof Error ? error.message : String(error)
  )
  const { failureCode, failureStage } = deriveAuditFailure(
    error,
    pageRuns.some((p) => p.judge) ? 'judging' : 'checking'
  )

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
