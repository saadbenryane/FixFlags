import { z } from 'zod'
import { toJsonSchema } from '../zod-json-schema'

const stepPlanSchema = z.object({
  stepNumber: z.number().int().min(1).max(10),
  action: z.enum(['navigate', 'click', 'fill', 'submit', 'evaluate', 'scroll']),
  target: z.string().min(1).max(200),
  expectedResult: z.string().min(1).max(200),
  evidence: z.array(z.string()).max(5),
})

export const journeyPlanSchema = z.object({
  goal: z.string().min(1).max(300),
  steps: z.array(stepPlanSchema).min(1).max(10),
  confidence: z.number().min(0).max(1),
  estimatedDurationMs: z.number().int().min(5000).max(120_000),
})

export type StepPlan = z.infer<typeof stepPlanSchema>
export type JourneyPlan = z.infer<typeof journeyPlanSchema>

/** New plans can request only implemented public, read-only actions. */
export const journeyPlanProviderSchema = journeyPlanSchema.extend({
  steps: z.array(stepPlanSchema.extend({
    action: z.enum(['navigate', 'click', 'evaluate']),
    target: z.string().min(1).max(200).describe('Exact recorded link label or URL for navigation; recorded subject for evaluation.'),
    expectedResult: z.string().min(1).max(200).describe('Unverified intention, never an observation or proof of customer success.'),
  }).strict()).min(1).max(10),
}).strict()

export const JOURNEY_PLAN_PARAMETERS = toJsonSchema(journeyPlanProviderSchema)
export const JOURNEY_PLAN_TOOL_OPENAI = {
  type: 'function' as const,
  function: { name: 'plan_journey', description: 'Plan an observed read-only public journey',
    strict: true, parameters: JOURNEY_PLAN_PARAMETERS },
}
