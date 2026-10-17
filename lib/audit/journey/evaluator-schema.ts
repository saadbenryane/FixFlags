import { z } from 'zod'
import { toJsonSchema } from '../zod-json-schema'

export const journeyEvidenceRefSchema = z.object({
  stepNumber: z.number().int().min(1),
  source: z.enum(['accessibilityTree', 'actionDetail', 'elementDescription', 'outcomeDetail', 'consoleErrors', 'networkErrors']),
  quote: z.string().trim().min(3).max(500),
}).strict()
const evidenceRefs = z.array(journeyEvidenceRefSchema).min(1).max(6)


const frictionPointSchema = z.object({
  evidenceRefs: evidenceRefs.optional(),
  stepNumber: z.number().int().min(1),
  type: z.enum([
    'hesitation',
    'confusion',
    'too-many-steps',
    'unclear-progress',
    'missing-feedback',
  ]),
  description: z.string().min(1).max(300),
  evidence: z.string().min(1).max(500),
  severity: z.enum(['CRITICAL', 'IMPORTANT', 'POLISH']),
  rubric: z.enum(['MESSAGE', 'EXPERIENCE', 'REACH']),
  impactTag: z.enum([
    'CONVERSION',
    'REVENUE',
    'TRUST',
    'MEASUREMENT',
    'SHARING',
    'SEO',
    'ACCESSIBILITY',
    'CLARITY',
    'AUTHORITY',
    'FRICTION',
    'EMOTION',
  ]),
})

const brokenPromiseSchema = z.object({
  evidenceRefs: evidenceRefs.optional(),
  stepNumber: z.number().int().min(1),
  expected: z.string().min(1).max(300),
  actual: z.string().min(1).max(300),
  evidence: z.string().min(1).max(500),
  severity: z.enum(['CRITICAL', 'IMPORTANT']),
})

const accessibilityBarrierSchema = z.object({
  evidenceRefs: evidenceRefs.optional(),
  stepNumber: z.number().int().min(1),
  barrier: z.string().min(1).max(300),
  element: z.string().min(1).max(200),
  evidence: z.string().min(1).max(500),
})

export const journeyEvaluationSchema = z.object({
  frictionPoints: z.array(frictionPointSchema).max(10),
  brokenPromises: z.array(brokenPromiseSchema).max(5),
  accessibilityBarriers: z.array(accessibilityBarrierSchema).max(5),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(500),
})

export type FrictionPoint = z.infer<typeof frictionPointSchema>
export type BrokenPromise = z.infer<typeof brokenPromiseSchema>
export type AccessibilityBarrier = z.infer<typeof accessibilityBarrierSchema>
export type JourneyEvaluation = z.infer<typeof journeyEvaluationSchema>

/** Historical readers accept missing references. New model responses cannot omit them. */
export const journeyEvaluationProviderSchema = journeyEvaluationSchema.extend({
  frictionPoints: z.array(frictionPointSchema.extend({ evidenceRefs })).max(10),
  brokenPromises: z.array(brokenPromiseSchema.extend({ evidenceRefs })).max(5),
  accessibilityBarriers: z.array(accessibilityBarrierSchema.extend({ evidenceRefs })).max(5),
})
export const JOURNEY_EVALUATION_PARAMETERS = toJsonSchema(journeyEvaluationProviderSchema) as Record<string, unknown>
export const JOURNEY_EVALUATION_TOOL_OPENAI = {
  type: 'function' as const,
  function: { name: 'evaluate_journey', description: 'Review only the recorded journey evidence', parameters: JOURNEY_EVALUATION_PARAMETERS },
}
