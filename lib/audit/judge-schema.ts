import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type Anthropic from '@anthropic-ai/sdk'

export const rubricNameSchema = z.enum(['MESSAGE', 'EXPERIENCE', 'REACH'])

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

export const judgeOutputSchema = z.object({
  pageJob: z
    .string()
    .min(1)
    .describe(
      'One sentence: what job is this page trying to do? e.g. "Convert SaaS visitors into free trial signups"'
    ),
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
      'Two sentences. First: the honest overall judgment. Second: the one thing that matters most right now. Write it the way you would say it to the founder directly. Specific, not diplomatic.'
    ),
  score: z.number().min(0).max(100).describe('Overall quality score 0-100'),
  launchReadiness: z
    .enum(['safe', 'fix_first', 'not_ready'])
    .describe(
      'Is this page safe to share publicly? safe = ship it, fix_first = fix top issues first, not_ready = do not post yet'
    ),
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
      rubricPrompt: z
        .string()
        .min(1)
        .describe(
          'A holistic prompt that fixes ALL flags in this rubric at once. Must be specific, actionable, reference actual content from the page, and be ready to paste into an AI coding agent.'
        ),
      cursorPrompt: z.string().optional().describe('Tool-specific prompt with file-path references when inferable from the page'),
      claudePrompt: z.string().optional(),
      lovablePrompt: z.string().optional().describe('Tool-specific prompt describing visual and component changes'),
      boltPrompt: z.string().optional(),
    })
  ),
  newFlags: z
    .array(
      z.object({
        rubric: rubricNameSchema,
        impactTag: impactTagSchema,
        severity: z.enum(['CRITICAL', 'IMPORTANT', 'POLISH']),
        problem: z.string().min(1),
        evidence: z.string().min(1),
        whyItMatters: z
          .string()
          .min(1)
          .describe('1-2 sentences explaining the real-world business impact'),
        fix: z.string().min(1).describe('Numbered steps for fixing the issue (e.g. "1. Open metadata export\\n2. Add og:image\\n3. Verify")'),
        confidence: z.number().min(0).max(1),
        agentPrompt: z.string().optional(),
        cursorPrompt: z.string().optional(),
        claudePrompt: z.string().optional(),
        lovablePrompt: z.string().optional(),
        boltPrompt: z.string().optional(),
        verificationRule: z.string().min(1).nullish(),
        pageUrl: z.string().url().optional(),
      })
    )
    .describe(
      '0-2 net-new flags only for issues deterministic rules cannot catch. Never restate a deterministic flag in different words.'
    ),
  enrichments: z
    .array(
      z.object({
        checkId: z.string().min(1),
        whyItMatters: z
          .string()
          .min(1)
          .describe('1-2 sentences explaining the real-world impact'),
        agentPrompt: z.string().optional(),
        cursorPrompt: z.string().optional(),
        claudePrompt: z.string().optional(),
        lovablePrompt: z.string().optional(),
        boltPrompt: z.string().optional(),
        verificationRule: z
          .string()
          .min(1)
          .nullish()
          .describe('How to verify this is fixed'),
      })
    )
    .describe(
      'One enrichment per deterministic flag checkId, adds whyItMatters and agent-specific prompts'
    ),
})

export type JudgeOutput = z.infer<typeof judgeOutputSchema>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const generatedSchema = zodToJsonSchema(judgeOutputSchema as any, {
  target: 'openApi3',
  $refStrategy: 'none',
})
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Check = typeof generatedSchema

export const QUALITY_REPORT_SCHEMA = generatedSchema

export const QUALITY_REPORT_TOOL: Anthropic.Tool = {
  name: 'quality_report',
  description: 'Output a structured quality audit report for a website',
  input_schema: QUALITY_REPORT_SCHEMA as Anthropic.Tool.InputSchema,
}
