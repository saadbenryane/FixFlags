import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { currentExecutionOwnership, executionWrite } from './execution-ownership'
import type { LlmUsage } from './judge-runner'

export type ProviderUsagePhase = 'triage' | 'prescription' | 'journey_planner' | 'journey_evaluator'
export const INITIAL_ANALYSIS_PROVIDER_PHASES = ['triage', 'journey_planner', 'journey_evaluator'] as const
export type ProviderUsageAdmission = (model: string) => Promise<(usage: LlmUsage | null) => Promise<void>>

export const providerUsageSchema = z.object({ version: z.literal(1), responseId: z.string().uuid(),
  model: z.string().min(1).max(200), usage: z.object({
    inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative(),
    cacheReadTokens: z.number().int().nonnegative(), cacheWriteTokens: z.number().int().nonnegative(),
  }).strict().nullable() }).strict()

/** Admission precedes the external request. Lost response authority leaves an
 * inspectable unknown attempt without granting late customer writes. */
export async function beginProviderUsage(auditId: string, phase: ProviderUsagePhase, model: string): Promise<(usage: LlmUsage | null) => Promise<void>> {
  const owner = currentExecutionOwnership()
  if (!owner || owner.auditId !== auditId || (phase === 'prescription' && !owner.taskId)) throw new Error('Provider usage requires its matching execution owner')
  const taskId = owner.taskId, executionId = taskId ?? auditId
  const admitted = providerUsageSchema.parse({ version: 1, responseId: randomUUID(), model, usage: null })
  await executionWrite(tx => tx.auditPipelineEvent.create({ data: { auditId, executionId, traceId: auditId,
    attempt: owner.generation, stage: 'judging', event: `${phase}_provider_attempt`, status: 'info', detail: admitted } }))
  return async usage => {
    const active = currentExecutionOwnership()
    if (active?.auditId !== auditId || active.taskId !== taskId || active.token !== owner.token || active.generation !== owner.generation)
      throw new Error('Provider response no longer owns its admitted execution')
    const detail = providerUsageSchema.parse({ ...admitted, model: usage?.model ?? model,
      usage: usage ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens ?? 0, cacheWriteTokens: usage.cacheWriteTokens ?? 0 } : null })
    await executionWrite(tx => tx.auditPipelineEvent.create({ data: { auditId, executionId, traceId: auditId,
      attempt: owner.generation, stage: 'judging', event: `${phase}_provider_response`, status: 'info', detail } }))
  }
}

export function sumProviderResponses(events: readonly { event?: string; detail: unknown }[], phase: ProviderUsagePhase) {
  let complete = true
  const measurements: LlmUsage[] = []
  const attempts = new Map<string, string>(), responses = new Map<string, string>()
  for (const event of events) {
    const parsed = providerUsageSchema.safeParse(event.detail)
    if (!parsed.success) { complete = false; continue }
    const { responseId, model, usage } = parsed.data
    if (event.event && ![`${phase}_provider_attempt`, `${phase}_provider_response`].includes(event.event)) { complete = false; continue }
    if (event.event === `${phase}_provider_attempt`) {
      if (attempts.has(responseId) && attempts.get(responseId) !== model) complete = false
      attempts.set(responseId, model)
      continue
    }
    const serialized = JSON.stringify(parsed.data)
    if (responses.has(responseId)) {
      if (responses.get(responseId) !== serialized) complete = false
      continue
    }
    responses.set(responseId, serialized)
    if (!usage) { complete = false; continue }
    measurements.push({ ...usage, model })
  }
  if ([...attempts.keys()].some(id => !responses.has(id)) || [...responses.keys()].some(id => !attempts.has(id))) complete = false
  return { measurements, complete, inputTokens: measurements.reduce((sum, item) => sum + item.inputTokens, 0),
    outputTokens: measurements.reduce((sum, item) => sum + item.outputTokens, 0),
    cacheReadTokens: measurements.reduce((sum, item) => sum + (item.cacheReadTokens ?? 0), 0),
    cacheWriteTokens: measurements.reduce((sum, item) => sum + (item.cacheWriteTokens ?? 0), 0),
    model: [...new Set(measurements.length ? measurements.map(item => item.model) : attempts.values())].join(',') }
}

/** The existing phase-one subtotal covers every initial-analysis provider. */
export function sumAnalysisProviderResponses(events: readonly { event?: string; detail: unknown }[]) {
  const phases = INITIAL_ANALYSIS_PROVIDER_PHASES.map(phase => sumProviderResponses(
    events.filter(event => event.event === `${phase}_provider_attempt` || event.event === `${phase}_provider_response`), phase))
  const measurements = phases.flatMap(phase => phase.measurements)
  return { measurements, complete: phases.every(phase => phase.complete),
    inputTokens: phases.reduce((sum, phase) => sum + phase.inputTokens, 0),
    outputTokens: phases.reduce((sum, phase) => sum + phase.outputTokens, 0),
    cacheReadTokens: phases.reduce((sum, phase) => sum + phase.cacheReadTokens, 0),
    cacheWriteTokens: phases.reduce((sum, phase) => sum + phase.cacheWriteTokens, 0),
    model: [...new Set(phases.flatMap(phase => phase.model ? phase.model.split(',') : []))].join(',') }
}
