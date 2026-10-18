import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { currentExecutionOwnership, executionWrite } from './execution-ownership'
import type { LlmUsage } from './judge-runner'

export const prescriptionUsageSchema = z.object({ version: z.literal(1), responseId: z.string().uuid(),
  model: z.string().min(1).max(200), usage: z.object({
    inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative(),
    cacheReadTokens: z.number().int().nonnegative(), cacheWriteTokens: z.number().int().nonnegative(),
  }).strict().nullable() }).strict()

/** Record consumption before parsing or assessing the provider's response. */
export async function recordPrescriptionUsage(auditId: string, usage: LlmUsage | null, model: string): Promise<void> {
  const owner = currentExecutionOwnership()
  if (!owner?.taskId || owner.auditId !== auditId) throw new Error('Prescription usage requires its execution task')
  const taskId = owner.taskId
  const detail = prescriptionUsageSchema.parse({ version: 1, responseId: randomUUID(), model,
    usage: usage ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens ?? 0, cacheWriteTokens: usage.cacheWriteTokens ?? 0 } : null })
  await executionWrite(tx => tx.auditPipelineEvent.create({ data: { auditId, executionId: taskId, traceId: auditId,
    attempt: owner.generation, stage: 'judging', event: 'prescription_provider_response', status: 'info', detail } }))
}

export function sumPrescriptionResponses(events: readonly { detail: unknown }[]) {
  let complete = true
  const measurements: LlmUsage[] = []
  const seen = new Set<string>()
  for (const event of events) {
    const parsed = prescriptionUsageSchema.safeParse(event.detail)
    if (!parsed.success) { complete = false; continue }
    if (seen.has(parsed.data.responseId)) continue
    seen.add(parsed.data.responseId)
    if (!parsed.data.usage) { complete = false; continue }
    measurements.push({ ...parsed.data.usage, model: parsed.data.model })
  }
  return { measurements, complete, inputTokens: measurements.reduce((sum, item) => sum + item.inputTokens, 0),
    outputTokens: measurements.reduce((sum, item) => sum + item.outputTokens, 0),
    cacheReadTokens: measurements.reduce((sum, item) => sum + (item.cacheReadTokens ?? 0), 0),
    cacheWriteTokens: measurements.reduce((sum, item) => sum + (item.cacheWriteTokens ?? 0), 0),
    model: [...new Set(measurements.map(item => item.model))].join(',') }
}
