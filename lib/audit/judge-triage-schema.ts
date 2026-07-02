import { z } from 'zod'
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
])

export const triageOutputSchema = z.object({
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
      z.object({
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
    )
    .describe('Five binary launch checks'),
  rubrics: z.array(
    z.object({
      name: rubricNameSchema,
      score: z
        .number()
        .min(0)
        .max(100)
        .nullable()
        .describe('Score 0-100 when assessed; null only when evidence is unavailable'),
      grade: z.enum(['A', 'B', 'C', 'D', 'F']),
      status: z.enum(['EXCELLENT', 'GOOD', 'NEEDS_WORK', 'CRITICAL']),
      assessmentState: z.enum(['ASSESSED', 'PARTIAL', 'UNKNOWN']),
      confidence: z.number().min(0).max(1),
      summary: z.string().min(1).describe('2-3 sentences describing issues and impact'),
    })
  ),
  newFlags: z
    .array(
      z.object({
        rubric: rubricNameSchema,
        impactTag: impactTagSchema,
        severity: z.enum(['CRITICAL', 'IMPORTANT', 'POLISH']),
        problem: z.string().min(1).describe('The flag title - one concise line naming the issue'),
        confidence: z.number().min(0).max(1),
        pageUrl: z.string().url().optional(),
      })
    )
    .describe(
      '0-2 net-new flag TITLES only, for issues deterministic rules cannot catch. Do not restate a deterministic flag. Do NOT write fixes or prompts - titles only.'
    ),
})

export type TriageOutput = z.infer<typeof triageOutputSchema>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const generatedSchema = zodToJsonSchema(triageOutputSchema as any, {
  target: 'openApi3',
  $refStrategy: 'none',
})

export const QUALITY_TRIAGE_SCHEMA = generatedSchema

export const QUALITY_TRIAGE_TOOL: Anthropic.Tool = {
  name: 'quality_triage',
  description: 'Output a fast, high-level quality triage for a website (score, grades, flag titles)',
  input_schema: QUALITY_TRIAGE_SCHEMA as Anthropic.Tool.InputSchema,
}
