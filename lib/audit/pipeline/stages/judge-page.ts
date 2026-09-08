import { prisma } from '@/lib/db'
import type { DeterministicFlag } from '@/lib/audit/checks'
import { isTriageProviderConfigured, type TriageResult } from '@/lib/audit/judge-triage'
import type { PageMetadata } from '@/lib/audit/metadata'
import type { PageSpeedResult } from '@/lib/audit/pagespeed'
import { MIN_JUDGE_BUDGET_MS } from '@/lib/audit/pipeline-config'
import { AuditDeadlineError } from '@/lib/audit/pipeline-errors'
import { PIPELINE_PROGRESS } from '@/lib/audit/progress'
import { accumulateTriageUsage } from '@/lib/audit/pipeline/context'
import { parseTriageFailure, type TriageFailure } from '@/lib/audit/pipeline/triage-failure'
import { runTriageStep } from '@/lib/audit/pipeline/triage-step'
import type { PipelineContext, ReviewStageResult } from '@/lib/audit/pipeline/types'

export interface JudgePageArtifact {
  triage?: TriageResult
  triageFailure?: TriageFailure
}

interface JudgePageInput {
  pageId: string
  url: string
  metadata: PageMetadata
  desktop: PageSpeedResult | null
  mobile: PageSpeedResult | null
  flags: DeterministicFlag[]
  desktopBase64: string
  mobileBase64: string | null
  completeness: 'FULL' | 'PARTIAL'
}

/**
 * The only per-page external-judge boundary. Captured deterministic evidence
 * is preserved on every partial or skipped result.
 */
export async function judgePageStage(
  ctx: PipelineContext,
  input: JudgePageInput
): Promise<ReviewStageResult<JudgePageArtifact>> {
  const startedAt = ctx.clock.now().getTime()
  let artifact: JudgePageArtifact = {}

  if (!isTriageProviderConfigured()) {
    artifact = {
      triageFailure: {
        reason: 'no_provider_keys',
        message: 'No AI provider keys configured for triage',
        retryable: false,
      },
    }
    await ctx.events.log({
      stage: 'judging',
      event: 'triage_skipped_no_provider',
      status: 'skipped',
    })
  } else {
    await prisma.auditPage.update({
      where: { id: input.pageId },
      data: { status: 'JUDGING' },
    })
    await prisma.audit.update({
      where: { id: ctx.auditId },
      data: { status: 'JUDGING', progress: PIPELINE_PROGRESS.JUDGING },
    })

    const remainingMs = ctx.deadline - ctx.clock.now().getTime()
    await ctx.events.log({
      stage: 'judging',
      event: 'triage_budget_ms',
      detail: String(Math.max(0, remainingMs - MIN_JUDGE_BUDGET_MS)),
    })

    if (remainingMs < MIN_JUDGE_BUDGET_MS) {
      const triageFailure = parseTriageFailure(new AuditDeadlineError('judging'))
      artifact = {
        triageFailure,
      }
      await ctx.events.log({
        stage: 'judging',
        event: 'triage_skipped_deadline',
        status: 'skipped',
        error: triageFailure.message,
      })
    } else {
      try {
        const triage = await runTriageStep(ctx, input)
        accumulateTriageUsage(ctx, triage)
        triage.output.newFlags = triage.output.newFlags.map((flag) => ({
          ...flag,
          pageUrl: input.url,
        }))
        artifact = { triage }
      } catch (error) {
        const triageFailure = parseTriageFailure(error)
        artifact = { triageFailure }
        await ctx.events.log({
          stage: 'judging',
          event: 'triage_step_failed',
          status: 'partial',
          error: triageFailure.message,
          detail: triageFailure.reason,
        })
      }
    }
  }

  await prisma.auditPage.update({
    where: { id: input.pageId },
    data: { status: 'COMPLETED', completeness: input.completeness },
  })

  return {
    status: artifact.triage
      ? 'complete'
      : artifact.triageFailure?.reason === 'no_provider_keys' ||
          artifact.triageFailure?.reason === 'deadline_exhausted'
        ? 'skipped'
        : 'partial',
    artifact,
    evidenceGaps: artifact.triageFailure
      ? [`judge:${artifact.triageFailure.reason}`]
      : [],
    durationMs: ctx.clock.now().getTime() - startedAt,
  }
}
