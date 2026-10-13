import { z } from 'zod'
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
  // Nullable+required (not optional) so OpenAI strict mode can list every
  // property in `required`. Empty string or null means "use fix as the Task".
  agentPrompt: z
    .string()
    .nullable()
    .describe(
      'Short task body: named element, current text or behavior, desired outcome. No file paths. No URL required. Copy-time assembly supplies ground and method. Null when the fix field is enough.'
    ),
  cursorPrompt: z.string().nullable(),
  claudePrompt: z.string().nullable(),
  windsurfPrompt: z.string().nullable(),
  lovablePrompt: z.string().nullable(),
  boltPrompt: z.string().nullable(),
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
  cursorPrompt: z.string().nullable(),
  claudePrompt: z.string().nullable(),
  windsurfPrompt: z.string().nullable(),
  lovablePrompt: z.string().nullable(),
  boltPrompt: z.string().nullable(),
})

export const prescriptionOutputSchema = z.object({
  flagPrescriptions: z
    .array(flagPrescriptionSchema)
    .describe(
      'One prescription per UNIQUE flagKey in the provided flags - if the same checkId ' +
        'appears on more than one page (a Product Review that fully reviewed linked pages), it is one ' +
        'issue with one flagKey and needs exactly one prescription, not one per occurrence'
    ),
  rubricPrescriptions: z
    .array(rubricPrescriptionSchema)
    .describe('Holistic rubric-level fix prompts for MESSAGE, EXPERIENCE, and REACH'),
})

export type PrescriptionOutput = z.infer<typeof prescriptionOutputSchema>

/** The provider cannot omit or invent an admitted Flag identity. */
function providerOutputSchema(flagKeys: string[]) {
  const entry = flagPrescriptionSchema.omit({ flagKey: true }).strict()
  const keys = [...new Set(flagKeys)]
  if (keys.some(key => !key.trim())) throw new Error('Prescription Flag keys must be nonempty')
  return z.object({
    flagPrescriptions: z.object(Object.fromEntries(keys.map(key => [key, entry]))).strict(),
    rubricPrescriptions: prescriptionOutputSchema.shape.rubricPrescriptions,
  }).strict()
}

export function prescriptionProviderJsonSchema(flagKeys: string[], provider: 'openai' | 'anthropic') {
  const schema = toJsonSchema(providerOutputSchema(flagKeys))
  return (provider === 'openai' ? stripFormatKeyword(schema) : toOpenApiNullableSchema(schema)) as Record<string, unknown>
}

/** Normalize actual keyed provider content into the existing stored contract. */
export function parsePrescriptionProviderOutput(raw: unknown, flagKeys: string[]): PrescriptionOutput {
  const parsed = providerOutputSchema(flagKeys).safeParse(raw)
  if (!parsed.success) throw new Error(`Invalid prescription output: ${parsed.error.message}`)
  return {
    flagPrescriptions: Object.entries(parsed.data.flagPrescriptions).map(([flagKey, prescription]) => ({ ...prescription, flagKey })),
    rubricPrescriptions: parsed.data.rubricPrescriptions,
  }
}
