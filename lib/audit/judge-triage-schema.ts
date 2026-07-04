import { z, type ZodTypeAny } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type Anthropic from '@anthropic-ai/sdk'
import { rubricNameSchema } from './judge-schema'

/**
 * Phase-1 "triage" schema. Deliberately small: it produces the teaser a cold
 * visitor sees on their OWN site - a real score, verdict, rubric grades, and
 * flag *titles* - but NONE of the expensive, extractable payload (fix prompts,
 * evidence, whyItMatters, per-tool prompts, enrichments). That payload is
 * generated only after signup by the phase-2 "prescription" pass.
 *
 * Keeping the tool schema this small is what keeps the triage call cheap: the
 * model has far fewer fields to fill, so output tokens stay low.
 */

const impactTagSchema = z.enum([
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
])

export const triageOutputSchema = z
  .object({
    pageJob: z
      .string()
      .min(1)
      .describe('One sentence: what job is this page trying to do?'),
    pageType: z.enum([
      'homepage',
      'pricing',
      'landing',
      'dashboard',
      'portfolio',
      'article',
      'other',
    ]),
    verdict: z
      .string()
      .min(1)
      .describe(
        'Two sentences. First: the honest overall judgment. Second: the one thing that matters most right now. Speak directly to the founder. Specific, not diplomatic.'
      ),
    score: z.number().min(0).max(100).describe('Overall quality score 0-100'),
    launchReadiness: z
      .enum(['safe', 'fix_first', 'not_ready'])
      .describe('safe = ship it, fix_first = fix top issues first, not_ready = do not post yet'),
    launchChecklist: z
      .array(
        z
          .object({
            id: z.enum([
              'https',
              'social-preview',
              'mobile-cta',
              'console-errors',
              'privacy-contact',
            ]),
            label: z.string().min(1),
            passed: z.boolean(),
          })
          .strict()
      )
      .describe('Five binary launch checks'),
    rubrics: z.array(
      z
        .object({
          name: rubricNameSchema,
          score: z
            .number()
            .min(0)
            .max(100)
            .nullable()
            .describe(
              'Score 0-100 only when assessmentState is ASSESSED; must be null when assessmentState is PARTIAL or UNKNOWN'
            ),
          grade: z.enum(['A', 'B', 'C', 'D', 'F']),
          status: z.enum(['EXCELLENT', 'GOOD', 'NEEDS_WORK', 'CRITICAL']),
          assessmentState: z
            .enum(['ASSESSED', 'PARTIAL', 'UNKNOWN'])
            .describe(
              'ASSESSED means score is required; PARTIAL or UNKNOWN means score must be null'
            ),
          confidence: z.number().min(0).max(1),
          summary: z.string().min(1).describe('2-3 sentences describing issues and impact'),
        })
        .strict()
    ),
    newFlags: z
      .array(
        z
          .object({
            rubric: rubricNameSchema,
            impactTag: impactTagSchema,
            severity: z.enum(['CRITICAL', 'IMPORTANT', 'POLISH']),
            problem: z
              .string()
              .min(1)
              .describe('The flag title - one concise line naming the issue'),
            confidence: z.number().min(0).max(1),
            // Nullable+required (not optional) so this schema can be generated in
            // OpenAI strict-mode form, which requires every property in `required`.
            pageUrl: z
              .string()
              .url()
              .nullable()
              .describe('The specific page URL this flag applies to, or null for the primary page'),
          })
          .strict()
      )
      .describe(
        '2-5 net-new flag TITLES only, for UX-expert issues deterministic rules cannot catch. Do not restate a deterministic flag. Do NOT write fixes or prompts - titles only.'
      ),
  })
  .strict()

export type TriageOutput = z.infer<typeof triageOutputSchema>

const generatedSchema = zodToJsonSchema(triageOutputSchema as ZodTypeAny, {
  target: 'openApi3',
  $refStrategy: 'none',
})

export const QUALITY_TRIAGE_SCHEMA = generatedSchema

export const QUALITY_TRIAGE_TOOL: Anthropic.Tool = {
  name: 'quality_triage',
  description: 'Output a fast, high-level quality triage for a website (score, grades, flag titles)',
  input_schema: QUALITY_TRIAGE_SCHEMA as Anthropic.Tool.InputSchema,
}

/** Recursively strips JSON Schema `format` keywords (e.g. "uri", "email"). OpenAI's
 * strict function-calling mode rejects the whole schema (400) if any node uses a
 * `format` it doesn't support - the actual format constraint is still enforced by
 * `triageOutputSchema.parse()` (Zod's `.url()`) once the response comes back. */
function stripFormatKeyword(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripFormatKeyword)
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>)
        .filter(([key]) => key !== 'format')
        .map(([key, value]) => [key, stripFormatKeyword(value)])
    )
  }
  return node
}

/**
 * OpenAI's strict function-calling mode requires standard JSON Schema (nullable
 * fields as `type: [T, "null"]`, not the OpenAPI 3 `nullable: true` extension the
 * Anthropic-facing schema above uses) plus `additionalProperties: false` on every
 * object, which the `.strict()` calls on `triageOutputSchema` above provide - and
 * no unsupported `format` keywords (see `stripFormatKeyword` above).
 */
const openaiSchemaWithFormat = zodToJsonSchema(triageOutputSchema as ZodTypeAny, {
  $refStrategy: 'none',
}) as Record<string, unknown>
delete openaiSchemaWithFormat.$schema

export const QUALITY_TRIAGE_SCHEMA_OPENAI = stripFormatKeyword(openaiSchemaWithFormat) as Record<
  string,
  unknown
>
