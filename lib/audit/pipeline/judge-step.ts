import { runJudgeWithRetry, type JudgeResult } from '../judge'
import { logPipelineEvent } from '../pipeline-log'
import { FINALIZE_RESERVE_MS, MIN_JUDGE_BUDGET_MS } from '../pipeline-config'
import { AuditDeadlineError } from '../pipeline-errors'
import { assertDeadline } from './context'
import type { PipelineContext } from './types'
import type { PageMetadata } from '../metadata'
import type { PageSpeedResult } from '../pagespeed'
import type { DeterministicFlag } from '../checks'

interface JudgeStepInput {
  url: string
  metadata: PageMetadata
  desktop: PageSpeedResult | null
  mobile: PageSpeedResult | null
  flags: DeterministicFlag[]
  desktopBase64: string
  mobileBase64: string | null
}

/**
 * Run the AI judge for one page. Retry and provider fallback live in
 * {@link runJudgeWithRetry}; this step only enforces the deadline budget and
 * emits pipeline log events. The judge timeout is clamped to the time left
 * (minus a finalize reserve) so it can never consume the whole audit window.
 */
export async function runJudgeStep(
  ctx: PipelineContext,
  input: JudgeStepInput
): Promise<JudgeResult> {
  assertDeadline(ctx, 'judging')
  // Don't start a judge call we can't finish within the remaining budget; let the
  // audit fall back to deterministic results instead of timing out at the finish
  // line. The thrown deadline error is caught by tryPartialFinalize.
  if (ctx.deadline - Date.now() < MIN_JUDGE_BUDGET_MS) {
    throw new AuditDeadlineError('judging')
  }

  const judgeStart = Date.now()
  await logPipelineEvent(ctx.auditId, { stage: 'judging', event: 'judge_started' })

  const maxTimeoutMs = Math.max(0, ctx.deadline - Date.now() - FINALIZE_RESERVE_MS)
  const result = await runJudgeWithRetry(
    input.url,
    input.metadata,
    input.desktop,
    input.mobile,
    input.flags,
    input.desktopBase64,
    input.mobileBase64,
    maxTimeoutMs
  )

  await logPipelineEvent(ctx.auditId, {
    stage: 'judging',
    event: 'judge_completed',
    durationMs: Date.now() - judgeStart,
  })
  return result
}
