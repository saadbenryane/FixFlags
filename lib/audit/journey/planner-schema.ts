import { z } from 'zod'

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

export const JOURNEY_PLAN_TOOL_OPENAI = {
  type: 'function' as const,
  function: {
    name: 'plan_journey',
    description: 'Plan a multi-step user journey to evaluate a website experience',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'The goal of this journey (e.g. "Evaluate the signup-to-onboarding flow")' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stepNumber: { type: 'number', description: 'Step number starting from 1' },
              action: { type: 'string', enum: ['navigate', 'click', 'fill', 'submit', 'evaluate', 'scroll'], description: 'The action to perform' },
              target: { type: 'string', description: 'Natural language description of the target element' },
              expectedResult: { type: 'string', description: 'What the page should show after this step' },
              evidence: { type: 'array', items: { type: 'string' }, description: 'What to capture at this step' },
            },
            required: ['stepNumber', 'action', 'target', 'expectedResult', 'evidence'],
          },
        },
        confidence: { type: 'number', description: 'Confidence in the plan (0-1)' },
        estimatedDurationMs: { type: 'number', description: 'Estimated duration in milliseconds' },
      },
      required: ['goal', 'steps', 'confidence', 'estimatedDurationMs'],
    },
  },
}
