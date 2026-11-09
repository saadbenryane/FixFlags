import { runTriageWithRetry, buildTriageContext, triageInterpretationRequestDigests, revalidateTriageInterpretation, reusableTriageInterpretation, type TriageResult } from '../judge-triage'
import { FINALIZE_RESERVE_MS, MIN_JUDGE_BUDGET_MS } from '../pipeline-config'
import { AuditDeadlineError } from '../pipeline-errors'
import { assertDeadline } from './context'
import type { PipelineContext } from './types'
import type { PageMetadata } from '../metadata'
import type { PageSpeedResult } from '../pagespeed'
import type { DeterministicFlag } from '../checks'
import { prisma } from '@/lib/db'
import { observationIdentity } from '@/lib/audit/flag-identity'
import { renderedContentMetadata } from '../browser/rendered-copy'
import { beginProviderUsage } from '../provider-usage'
import { currentExecutionOwnership } from '../execution-ownership'
import { getConfiguredJudgeProviderChain, getTriageProviderConfig } from '../judge-config'
import { getScreenshotHint } from '../screenshot-hint'
import { exactTriageInterpretation } from '../progressive/interpretation'
import { captureObservationKey, captureProfileKey, type CaptureObservationScope } from '../browser/observation-scope'
import { DESKTOP_CAPTURE_PROFILE, MOBILE_CAPTURE_PROFILE } from '../browser/capture-profile'

interface TriageStepInput {
  url: string
  metadata: PageMetadata
  desktop: PageSpeedResult | null
  mobile: PageSpeedResult | null
  flags: DeterministicFlag[]
  desktopBase64: string
  mobileBase64: string | null
  observationScope?: CaptureObservationScope
  completeness?: 'FULL' | 'PARTIAL'
}

/** Run the phase-1 triage LLM for one page (cheap teaser pass). */
export async function runTriageStep(
  ctx: PipelineContext,
  input: TriageStepInput
): Promise<TriageResult> {
  assertDeadline(ctx, 'judging')
  if (ctx.deadline - ctx.clock.now().getTime() < MIN_JUDGE_BUDGET_MS) {
    throw new AuditDeadlineError('judging')
  }

  const triageStart = ctx.clock.now().getTime()
  await ctx.events.log({ stage: 'judging', event: 'triage_started' })

  const maxTimeoutMs = Math.max(0, ctx.deadline - ctx.clock.now().getTime() - FINALIZE_RESERVE_MS)
  if (input.metadata.renderedCopy !== undefined && !input.metadata.renderedCopy?.complete) {
    throw new Error('Rendered page copy could not be observed.')
  }
  const knownObservations = await loadKnownObservations(ctx.auditId)
  const evaluate = () => runTriageWithRetry(
    input.url,
    renderedContentMetadata(input.metadata),
    input.desktop,
    input.mobile,
    input.flags,
    input.desktopBase64,
    input.mobileBase64,
    maxTimeoutMs,
    knownObservations,
    (model, bound) => beginProviderUsage(ctx.auditId, 'triage', model, bound)
  )

  // Mutable aliases cannot prove an identical model snapshot. Reuse is
  // available only for explicitly pinned provider configurations.
  const configurations = currentExecutionOwnership()?.taskId ? getConfiguredJudgeProviderChain().map(provider => ({ provider,
    ...getTriageProviderConfig(provider) })) : []
  const pinned = configurations.length > 0 && configurations.every(config => /(?:-20\d{2}-\d{2}-\d{2}|-20\d{6})$/.test(config.model)
    // Claude 4.6+ canonical IDs are themselves pinned, including dateless IDs.
    // https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions
    || config.provider === 'anthropic' && /^claude-(?:sonnet|opus|haiku)-(?:[5-9](?:-\d+)?|4-(?:[6-9]|[1-9]\d+))$/.test(config.model))
  const eligible = pinned && input.completeness === 'FULL' && input.metadata.renderedCopy?.complete === true && input.observationScope
    && input.metadata.renderedCopy.pageUrl === input.observationScope.finalUrl
    && captureObservationKey(input.observationScope) !== 'unknown'
  const context = eligible ? { ...buildTriageContext(input.url, renderedContentMetadata(input.metadata), input.desktop,
    input.mobile, input.flags, knownObservations), screenshotHint: getScreenshotHint(input.desktopBase64, input.mobileBase64) } : null
  const result = context ? await exactTriageInterpretation({ auditId: ctx.auditId, deadline: ctx.deadline,
    input: () => ({ policy: 'triage-grounding-v2:exact-v2',
      requests: triageInterpretationRequestDigests(context, input.desktopBase64, input.mobileBase64, configurations),
      language: input.metadata.lang, observationScope: input.observationScope, completeness: input.completeness,
      profilePolicy: { desktop: captureProfileKey(DESKTOP_CAPTURE_PROFILE), mobile: captureProfileKey(MOBILE_CAPTURE_PROFILE) } }),
    evaluate, readEligible: value => reusableTriageInterpretation(value as TriageResult, configurations)
      ? revalidateTriageInterpretation(value, context, input.flags) : null,
    reusable: result => reusableTriageInterpretation(result, configurations),
  }) : await evaluate()

  await ctx.events.log({
    stage: 'judging',
    event: 'triage_completed',
    durationMs: ctx.clock.now().getTime() - triageStart,
  })
  return result
}

async function loadKnownObservations(auditId: string) {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { parentId: true },
  })
  if (!audit?.parentId) return undefined
  const parentFlags = await prisma.flag.findMany({
    where: { auditId: audit.parentId, source: 'AI' },
    select: {
      checkId: true,
      problem: true,
      rubric: true,
      fingerprint: true,
    },
  })
  if (parentFlags.length === 0) return undefined
  return parentFlags.map((flag) => ({
    identity: observationIdentity(flag),
    problem: flag.problem,
    rubric: flag.rubric,
  }))
}
