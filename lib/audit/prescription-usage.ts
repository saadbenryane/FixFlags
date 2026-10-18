import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { currentExecutionOwnership, executionWrite } from './execution-ownership'
import type { LlmUsage } from './judge-runner'

export const prescriptionUsageSchema = z.object({ version: z.literal(1), responseId: z.string().uuid(),
  model: z.string().min(1).max(200), usage: z.object({
    inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative(),
    cacheReadTokens: z.number().int().nonnegative(), cacheWriteTokens: z.number().int().nonnegative(),
  }).strict().nullable() }).strict()

/** Admission precedes the external request. Lost response authority leaves an
 * inspectable unknown attempt without granting late customer writes. */
export async function beginPrescriptionUsage(auditId: string, model: string): Promise<(usage: LlmUsage | null) => Promise<void>> {
  const owner = currentExecutionOwnership()
  if (!owner?.taskId || owner.auditId !== auditId) throw new Error('Prescription usage requires its execution task')
  const taskId = owner.taskId
  const admitted = prescriptionUsageSchema.parse({ version: 1, responseId: randomUUID(), model, usage: null })
  await executionWrite(tx => tx.auditPipelineEvent.create({ data: { auditId, executionId: taskId, traceId: auditId,
    attempt: owner.generation, stage: 'judging', event: 'prescription_provider_attempt', status: 'info', detail: admitted } }))
  return async usage => {
    const active = currentExecutionOwnership()
    if (active?.taskId !== taskId || active.token !== owner.token || active.generation !== owner.generation)
      throw new Error('Prescription response no longer owns its admitted task')
    const detail = prescriptionUsageSchema.parse({ ...admitted, model: usage?.model ?? model,
      usage: usage ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens ?? 0, cacheWriteTokens: usage.cacheWriteTokens ?? 0 } : null })
    await executionWrite(tx => tx.auditPipelineEvent.create({ data: { auditId, executionId: taskId, traceId: auditId,
      attempt: owner.generation, stage: 'judging', event: 'prescription_provider_response', status: 'info', detail } }))
  }
}

export function sumPrescriptionResponses(events: readonly { event?: string; detail: unknown }[]) {
  let complete = true
  const measurements: LlmUsage[] = []
  const attempts = new Map<string, string>(), responses = new Map<string, string>()
  for (const event of events) {
    const parsed = prescriptionUsageSchema.safeParse(event.detail)
    if (!parsed.success) { complete = false; continue }
    const { responseId, model, usage } = parsed.data
    if (event.event === 'prescription_provider_attempt') {
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
