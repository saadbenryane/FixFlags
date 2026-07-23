import { z } from 'zod'
import type Anthropic from '@anthropic-ai/sdk'
import { rubricNameSchema } from './judge-schema'
import {
  stripFormatKeyword,
  toJsonSchema,
  toOpenApiNullableSchema,
} from './zod-json-schema'

/**
 * Phase-1 "triage" schema. Produces the teaser a cold visitor sees: score,
 * verdict, rubric grades, flag titles, plus short evidence and whyItMatters.
 * Fix prompts and per-tool editor prompts stay for the phase-2 prescription
 * pass after signup/claim. Keep the schema small so triage stays cheap.
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
            evidence: z
              .string()
              .min(1)
              .describe(
                '1-2 sentences of concrete page evidence (quote copy, layout, or behavior). No fix instructions.'
              ),
            whyItMatters: z
              .string()
              .min(1)
              .describe(
                '1-2 sentences on user or business impact. No fix steps and no editor prompts.'
              ),
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
        '2-5 net-new flags for UX-expert issues deterministic rules cannot catch. Include problem, evidence, and whyItMatters. Do not restate a deterministic flag. Do NOT write fixes or editor prompts.'
      ),
  })
  .strict()

export type TriageOutput = z.infer<typeof triageOutputSchema>

const baseJsonSchema = toJsonSchema(triageOutputSchema)

/** Anthropic tool schema: OpenAPI-style `nullable: true` for null unions. */
export const QUALITY_TRIAGE_SCHEMA = toOpenApiNullableSchema(baseJsonSchema) as Record<
  string,
  unknown
>

export const QUALITY_TRIAGE_TOOL: Anthropic.Tool = {
  name: 'quality_triage',
  description: 'Output a fast, high-level quality triage for a website (score, grades, flag titles)',
  input_schema: QUALITY_TRIAGE_SCHEMA as Anthropic.Tool.InputSchema,
}

/**
 * OpenAI's strict function-calling mode requires standard JSON Schema (null as
 * `anyOf` / type unions, not OpenAPI `nullable: true`) plus
 * `additionalProperties: false` on every object, and no unsupported `format`
 * keywords. Zod parse still enforces `.url()` after the model responds.
 */
export const QUALITY_TRIAGE_SCHEMA_OPENAI = stripFormatKeyword(baseJsonSchema) as Record<
  string,
  unknown
>
