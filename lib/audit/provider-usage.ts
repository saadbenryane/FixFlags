import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { currentExecutionOwnership, executionWrite } from './execution-ownership'
import type { LlmUsage } from './judge-runner'
import { llmUsageSchema } from './provider-usage-contract'
import type { ProviderRequestBound } from './provider-request-bound'
import { providerBudgetAllocationSchema, reserveProviderBudget, settleProviderBudget } from '@/lib/billing/provider-budget'
import { estimateLlmMeasurementCostUsd, priceProviderMeasurement, providerPricingSchema } from '@/lib/billing/provider-pricing'

export type ProviderUsagePhase = 'triage' | 'prescription' | 'journey_planner' | 'journey_evaluator'
export const INITIAL_ANALYSIS_PROVIDER_PHASES = ['triage', 'journey_planner', 'journey_evaluator'] as const
export type ProviderUsageAdmission = (model: string, bound: ProviderRequestBound) => Promise<(usage: LlmUsage | null) => Promise<void>>

const legacyProviderUsageSchema = z.object({ version: z.literal(1), responseId: z.string().uuid(),
  model: z.string().min(1).max(200), usage: z.object({
    inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative(),
    cacheReadTokens: z.number().int().nonnegative(), cacheWriteTokens: z.number().int().nonnegative(),
  }).strict().nullable() }).strict()

export const providerUsageSchema = z.discriminatedUnion('version', [legacyProviderUsageSchema,
  z.object({ version: z.literal(2), responseId: z.string().uuid(), model: z.string().min(1).max(200),
    usage: llmUsageSchema.omit({ model: true }).required({ cacheReadTokens: true, cacheWriteTokens: true }).nullable() }).strict(),
  z.object({ version: z.literal(3), responseId: z.string().uuid(), model: z.string().min(1).max(200),
    request: z.object({ api: z.enum(['chat.completions', 'messages']), bodySha256: z.string().length(64),
      bodyBytes: z.number().int().nonnegative(), images: z.number().int().nonnegative(),
      inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().positive(),
      maxCostUsd: z.number().finite().nonnegative().nullable(), pricing: providerPricingSchema.nullable() }).strict(),
    budget: providerBudgetAllocationSchema,
    estimatedCostUsd: z.number().finite().nonnegative().nullable(),
    usage: llmUsageSchema.omit({ model: true }).required({ cacheReadTokens: true, cacheWriteTokens: true }).nullable() }).strict()])

/** Admission precedes the external request. Lost response authority leaves an
 * inspectable unknown attempt without granting late customer writes. */
export async function beginProviderUsage(auditId: string, phase: ProviderUsagePhase, model: string, bound: ProviderRequestBound): Promise<(usage: LlmUsage | null) => Promise<void>> {
  const owner = currentExecutionOwnership()
  if (!owner || owner.auditId !== auditId || (phase === 'prescription' && !owner.taskId)) throw new Error('Provider usage requires its matching execution owner')
  const taskId = owner.taskId, executionId = taskId ?? auditId
  if (bound.model !== model) throw new Error('Provider request model does not match its admission')
  const responseId = randomUUID()
  const admitted = await executionWrite(async tx => {
    const audit = await tx.audit.findUniqueOrThrow({ where: { id: auditId }, select: { projectId: true } })
    const budget = await reserveProviderBudget(tx, { runId: `audit:${auditId}`, siteId: audit.projectId }, bound)
    const { model: _model, ...request } = bound
    void _model
    const receipt = providerUsageSchema.parse({ version: 3, responseId, model, request, budget, estimatedCostUsd: null, usage: null })
    await tx.auditPipelineEvent.create({ data: { id: `provider-attempt:${responseId}`, auditId, executionId, traceId: auditId,
      attempt: owner.generation, stage: 'judging', event: `${phase}_provider_attempt`, status: 'info', detail: receipt } })
    return receipt
  })
  return async usage => {
    const active = currentExecutionOwnership()
    if (active?.auditId !== auditId || active.taskId !== taskId || active.token !== owner.token || active.generation !== owner.generation)
      throw new Error('Provider response no longer owns its admitted execution')
    const { model: responseModel, ...measurement } = usage ?? { model }
    const detail = providerUsageSchema.parse({ ...admitted, model: responseModel, estimatedCostUsd: usage ? priceProviderMeasurement(usage, bound.pricing) : null,
      usage: usage ? { ...measurement,
        cacheReadTokens: usage.cacheReadTokens ?? 0, cacheWriteTokens: usage.cacheWriteTokens ?? 0 } : null })
    await executionWrite(async tx => {
      // Execution ownership serializes this receipt with its request. Replayed
      // callbacks cannot settle an allocation twice or replace an unknown.
      const id = `provider-response:${responseId}`
      if (await tx.auditPipelineEvent.findUnique({ where: { id }, select: { id: true } })) return
      if (detail.version !== 3) throw new Error('Provider admission requires its current receipt')
      await settleProviderBudget(tx, detail.budget, detail.estimatedCostUsd)
      await tx.auditPipelineEvent.create({ data: { id, auditId, executionId, traceId: auditId,
        attempt: owner.generation, stage: 'judging', event: `${phase}_provider_response`, status: 'info', detail } })
    })
  }
}

export function sumProviderResponses(events: readonly { event?: string; detail: unknown }[], phase: ProviderUsagePhase) {
  let complete = true
  let estimatedCostUsd: number | null = 0
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
    const cost = parsed.data.version === 3 ? parsed.data.estimatedCostUsd : estimateLlmMeasurementCostUsd({ ...usage, model })
    estimatedCostUsd = cost === null || estimatedCostUsd === null ? null : estimatedCostUsd + cost
    measurements.push({ ...usage, model })
  }
  if ([...attempts.keys()].some(id => !responses.has(id)) || [...responses.keys()].some(id => !attempts.has(id))) complete = false
  return { measurements, complete, estimatedCostUsd: complete ? estimatedCostUsd : null, inputTokens: measurements.reduce((sum, item) => sum + item.inputTokens, 0),
    outputTokens: measurements.reduce((sum, item) => sum + item.outputTokens, 0),
    cacheReadTokens: measurements.reduce((sum, item) => sum + (item.cacheReadTokens ?? 0), 0),
    cacheWriteTokens: measurements.reduce((sum, item) => sum + (item.cacheWriteTokens ?? 0), 0),
    model: [...new Set(measurements.length ? measurements.map(item => item.model) : attempts.values())].join(',') }
}

/** The recorded consumption of a set of pipeline phases, summed per phase. */
export function sumProviderPhases(events: readonly { event?: string; detail: unknown }[], phases: readonly ProviderUsagePhase[]) {
  const totals = phases.map(phase => sumProviderResponses(
    events.filter(event => event.event === `${phase}_provider_attempt` || event.event === `${phase}_provider_response`), phase))
  const measurements = totals.flatMap(phase => phase.measurements)
  return { measurements, complete: totals.every(phase => phase.complete),
    estimatedCostUsd: totals.some(phase => phase.estimatedCostUsd === null) ? null : totals.reduce((sum, phase) => sum + phase.estimatedCostUsd!, 0),
    inputTokens: totals.reduce((sum, phase) => sum + phase.inputTokens, 0),
    outputTokens: totals.reduce((sum, phase) => sum + phase.outputTokens, 0),
    cacheReadTokens: totals.reduce((sum, phase) => sum + phase.cacheReadTokens, 0),
    cacheWriteTokens: totals.reduce((sum, phase) => sum + phase.cacheWriteTokens, 0),
    model: [...new Set(totals.flatMap(phase => phase.model ? phase.model.split(',') : []))].join(',') }
}
