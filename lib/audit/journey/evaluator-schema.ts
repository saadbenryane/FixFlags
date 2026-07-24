import { z } from 'zod'

const frictionPointSchema = z.object({
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
  stepNumber: z.number().int().min(1),
  expected: z.string().min(1).max(300),
  actual: z.string().min(1).max(300),
  evidence: z.string().min(1).max(500),
  severity: z.enum(['CRITICAL', 'IMPORTANT']),
})

const accessibilityBarrierSchema = z.object({
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

export const JOURNEY_EVALUATION_TOOL_OPENAI = {
  type: 'function' as const,
  function: {
    name: 'evaluate_journey',
    description: 'Evaluate a completed user journey for UX issues',
    parameters: {
      type: 'object',
      properties: {
        frictionPoints: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stepNumber: { type: 'number' },
              type: { type: 'string', enum: ['hesitation', 'confusion', 'too-many-steps', 'unclear-progress', 'missing-feedback'] },
              description: { type: 'string' },
              evidence: { type: 'string' },
              severity: { type: 'string', enum: ['CRITICAL', 'IMPORTANT', 'POLISH'] },
              rubric: { type: 'string', enum: ['MESSAGE', 'EXPERIENCE', 'REACH'] },
              impactTag: { type: 'string', enum: ['CONVERSION', 'REVENUE', 'TRUST', 'MEASUREMENT', 'SHARING', 'SEO', 'ACCESSIBILITY', 'CLARITY', 'AUTHORITY', 'FRICTION', 'EMOTION'] },
            },
            required: ['stepNumber', 'type', 'description', 'evidence', 'severity', 'rubric', 'impactTag'],
          },
        },
        brokenPromises: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stepNumber: { type: 'number' },
              expected: { type: 'string' },
              actual: { type: 'string' },
              evidence: { type: 'string' },
              severity: { type: 'string', enum: ['CRITICAL', 'IMPORTANT'] },
            },
            required: ['stepNumber', 'expected', 'actual', 'evidence', 'severity'],
          },
        },
        accessibilityBarriers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stepNumber: { type: 'number' },
              barrier: { type: 'string' },
              element: { type: 'string' },
              evidence: { type: 'string' },
            },
            required: ['stepNumber', 'barrier', 'element', 'evidence'],
          },
        },
        confidence: { type: 'number' },
        summary: { type: 'string' },
      },
      required: ['frictionPoints', 'brokenPromises', 'accessibilityBarriers', 'confidence', 'summary'],
    },
  },
}
