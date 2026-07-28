import { z } from 'zod'
import type Anthropic from '@anthropic-ai/sdk'
import { rubricNameSchema } from './judge-schema'
import { toJsonSchema, toOpenApiNullableSchema, stripFormatKeyword } from './zod-json-schema'

/**
 * Phase-2 "prescription" schema. Generates only the extractable payload keyed
 * to phase-1 flags. Diagnosis fields (score, verdict, flag titles) are NOT
 * regenerated - they merge onto existing rows by flagKey.
 */

export const flagPrescriptionSchema = z.object({
  flagKey: z
    .string()
    .min(1)
    .describe(
      'Stable key for the existing flag: use checkId for deterministic flags, or the flagFingerprint provided in context for AI flags'
    ),
  evidence: z.string().min(1).describe('What you see on the page that proves this issue'),
  whyItMatters: z
    .string()
    .min(1)
    .describe('1-2 sentences on real-world business impact'),
  fix: z.string().min(1).describe('1-3 numbered steps for fixing the issue, each starting with an action verb'),
  agentPrompt: z.string().optional(),
  cursorPrompt: z.string().optional(),
  claudePrompt: z.string().optional(),
  windsurfPrompt: z.string().optional(),
  lovablePrompt: z.string().optional(),
  boltPrompt: z.string().optional(),
  verificationRule: z
    .string()
    .min(1)
    .describe('How to verify this is fixed on the live page'),
})

export const rubricPrescriptionSchema = z.object({
  name: rubricNameSchema,
  rubricPrompt: z
    .string()
    .min(1)
    .describe('Holistic prompt fixing ALL flags in this rubric at once'),
  cursorPrompt: z.string().optional(),
  claudePrompt: z.string().optional(),
  windsurfPrompt: z.string().optional(),
  lovablePrompt: z.string().optional(),
  boltPrompt: z.string().optional(),
})

export const prescriptionOutputSchema = z.object({
  flagPrescriptions: z
    .array(flagPrescriptionSchema)
    .describe(
      'One prescription per UNIQUE flagKey in the provided flags - if the same checkId ' +
        'appears on more than one page (e.g. a multi-page critical-path scan), it is one ' +
        'issue with one flagKey and needs exactly one prescription, not one per occurrence'
    ),
  rubricPrescriptions: z
    .array(rubricPrescriptionSchema)
    .describe('Holistic rubric-level fix prompts for MESSAGE, EXPERIENCE, and REACH'),
})

export type PrescriptionOutput = z.infer<typeof prescriptionOutputSchema>

export const QUALITY_PRESCRIPTION_SCHEMA = toOpenApiNullableSchema(
  toJsonSchema(prescriptionOutputSchema)
) as Record<string, unknown>

export const QUALITY_PRESCRIPTION_TOOL: Anthropic.Tool = {
  name: 'quality_prescription',
  description: 'Generate fix prompts and evidence for an already-diagnosed audit',
  input_schema: QUALITY_PRESCRIPTION_SCHEMA as Anthropic.Tool.InputSchema,
}

const prescriptionBaseJsonSchema = toJsonSchema(prescriptionOutputSchema)

export const QUALITY_PRESCRIPTION_SCHEMA_OPENAI = stripFormatKeyword(
  prescriptionBaseJsonSchema
) as Record<string, unknown>
