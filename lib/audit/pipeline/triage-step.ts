import { runTriageWithRetry, type TriageResult } from '../judge-triage'
import { logPipelineEvent } from '../pipeline-log'
import { FINALIZE_RESERVE_MS, MIN_JUDGE_BUDGET_MS } from '../pipeline-config'
import { AuditDeadlineError } from '../pipeline-errors'
import { assertDeadline } from './context'
import type { PipelineContext } from './types'
import type { PageMetadata } from '../metadata'
import type { PageSpeedResult } from '../pagespeed'
import type { DeterministicFlag } from '../checks'
import { prisma } from '@/lib/db'
import { observationIdentity } from '@/lib/audit/flag-identity'

interface TriageStepInput {
  url: string
  metadata: PageMetadata
  desktop: PageSpeedResult | null
  mobile: PageSpeedResult | null
  flags: DeterministicFlag[]
  desktopBase64: string
  mobileBase64: string | null
}

/** Run the phase-1 triage LLM for one page (cheap teaser pass). */
export async function runTriageStep(
  ctx: PipelineContext,
  input: TriageStepInput
): Promise<TriageResult> {
  assertDeadline(ctx, 'judging')
  if (ctx.deadline - Date.now() < MIN_JUDGE_BUDGET_MS) {
    throw new AuditDeadlineError('judging')
  }

  const triageStart = Date.now()
  await logPipelineEvent(ctx.auditId, { stage: 'judging', event: 'triage_started' })

  const maxTimeoutMs = Math.max(0, ctx.deadline - Date.now() - FINALIZE_RESERVE_MS)
  const knownObservations = await loadKnownObservations(ctx.auditId)
  const result = await runTriageWithRetry(
    input.url,
    input.metadata,
    input.desktop,
    input.mobile,
    input.flags,
    input.desktopBase64,
    input.mobileBase64,
    maxTimeoutMs,
    knownObservations
  )

  await logPipelineEvent(ctx.auditId, {
    stage: 'judging',
    event: 'triage_completed',
    durationMs: Date.now() - triageStart,
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
