import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { z } from 'zod'
import {
  QUALITY_REPORT_SCHEMA,
  QUALITY_REPORT_TOOL,
  buildJudgePrompt,
} from '../prompts/system-prompt'
import { PageMetadata } from './metadata'
import { PageSpeedResult } from './pagespeed'
import { DeterministicFlag } from './checks'
import { sanitizeJudgeOutput } from './sanitize-prompts'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

export const rubricNameSchema = z.enum(['MESSAGE', 'EXPERIENCE', 'REACH'])

const impactTagSchema = z.enum([
  'CONVERSION',
  'REVENUE',
  'TRUST',
  'MEASUREMENT',
  'SHARING',
  'SEO',
  'ACCESSIBILITY',
])

const judgeOutputSchema = z.object({
  pageJob: z.string().min(1),
  pageType: z.enum([
    'homepage',
    'pricing',
    'landing',
    'dashboard',
    'portfolio',
    'article',
    'other',
  ]),
  verdict: z.string().min(1),
  score: z.number().min(0).max(100),
  launchReadiness: z.enum(['safe', 'fix_first', 'not_ready']),
  launchChecklist: z.array(
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
  ),
  rubrics: z.array(
    z.object({
      name: rubricNameSchema,
      score: z.number().min(0).max(100).nullable(),
      grade: z.enum(['A', 'B', 'C', 'D', 'F']),
      status: z.enum(['EXCELLENT', 'GOOD', 'NEEDS_WORK', 'CRITICAL']),
      assessmentState: z.enum(['ASSESSED', 'PARTIAL', 'UNKNOWN']),
      confidence: z.number().min(0).max(1),
      summary: z.string().min(1),
      rubricPrompt: z.string().min(1),
      cursorPrompt: z.string().optional(),
      claudePrompt: z.string().optional(),
      lovablePrompt: z.string().optional(),
      boltPrompt: z.string().optional(),
    })
  ),
  newFlags: z.array(
    z.object({
      rubric: rubricNameSchema,
      impactTag: impactTagSchema,
      severity: z.enum(['CRITICAL', 'IMPORTANT', 'POLISH']),
      problem: z.string().min(1),
      evidence: z.string().min(1),
      whyItMatters: z.string().min(1),
      fix: z.string().min(1),
      confidence: z.number().min(0).max(1),
      agentPrompt: z.string().optional(),
      cursorPrompt: z.string().optional(),
      claudePrompt: z.string().optional(),
      lovablePrompt: z.string().optional(),
      boltPrompt: z.string().optional(),
      verificationRule: z.string().min(1).nullish(),
      pageUrl: z.string().url().optional(),
    })
  ),
  enrichments: z.array(
    z.object({
      checkId: z.string().min(1),
      whyItMatters: z.string().min(1),
      agentPrompt: z.string().optional(),
      cursorPrompt: z.string().optional(),
      claudePrompt: z.string().optional(),
      lovablePrompt: z.string().optional(),
      boltPrompt: z.string().optional(),
      verificationRule: z.string().min(1).nullish(),
    })
  ),
})

export type JudgeOutput = z.infer<typeof judgeOutputSchema>

const ANTHROPIC_JUDGE_MODEL = 'claude-sonnet-4-20250514'
const OPENAI_JUDGE_MODEL = 'gpt-4o-mini'
const ANTHROPIC_MAX_TOKENS = 8192
const OPENAI_MAX_TOKENS = 4096
const OPENAI_JUDGE_TIMEOUT_MS = 60_000
const ANTHROPIC_JUDGE_TIMEOUT_MS = 45_000

export interface JudgeUsage {
  inputTokens: number
  outputTokens: number
  model: string
}

export interface JudgeResult {
  output: JudgeOutput
  usage: JudgeUsage
}

export function isRetryableJudgeError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (err.name === 'AbortError') return true
  const message = err.message.toLowerCase()
  return (
    message.includes('overloaded') ||
    message.includes('rate limit') ||
    message.includes('timeout') ||
    message.includes('aborted') ||
    message.includes('503') ||
    message.includes('529') ||
    message.includes('429')
  )
}

function buildJudgeContext(
  url: string,
  metadata: PageMetadata,
  desktop: PageSpeedResult | null,
  mobile: PageSpeedResult | null,
  flags: DeterministicFlag[]
) {
  return {
    url,
    pageText: metadata.pageText,
    metadata: {
      title: metadata.title,
      description: metadata.description,
      h1s: metadata.h1s,
      ctaTexts: metadata.ctaTexts,
      hasStructuredData: metadata.hasStructuredData,
    },
    scores: {
      desktopPerf: desktop?.score ?? null,
      mobilePerf: mobile?.score ?? null,
      desktopLcp: desktop?.lcp ?? null,
      mobileLcp: mobile?.lcp ?? null,
      cls: desktop?.cls ?? null,
    },
    topOpportunities: [...(desktop?.opportunities ?? []), ...(mobile?.opportunities ?? [])].slice(
      0,
      5
    ),
    deterministicFlags: flags.map((f) => ({
      checkId: f.checkId,
      problem: f.problem,
      evidence: f.evidence,
      rubric: f.rubric,
      severity: f.severity,
    })),
  }
}

function parseJudgeOutput(raw: unknown): JudgeOutput {
  const parsed = judgeOutputSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Invalid judge output: ${parsed.error.message}`)
  }
  return sanitizeJudgeOutput(parsed.data) as JudgeOutput
}

async function runAnthropicJudge(
  context: ReturnType<typeof buildJudgeContext>,
  desktopBase64: string | null,
  mobileBase64: string | null
): Promise<JudgeResult> {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not configured')

  const imageContent: Anthropic.ImageBlockParam[] = []
  if (desktopBase64) {
    imageContent.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: desktopBase64 },
    })
  }
  if (mobileBase64) {
    imageContent.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: mobileBase64 },
    })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ANTHROPIC_JUDGE_TIMEOUT_MS)

  try {
    const response = await anthropic.messages.create(
      {
        model: ANTHROPIC_JUDGE_MODEL,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        tools: [QUALITY_REPORT_TOOL],
        tool_choice: { type: 'tool', name: 'quality_report' },
        messages: [
          {
            role: 'user',
            content: [
              ...imageContent,
              {
                type: 'text',
                text: buildJudgePrompt({
                  ...context,
                  screenshotHint:
                    desktopBase64 && mobileBase64 ? 'desktop-and-mobile' : 'desktop-only',
                }),
              },
            ],
          },
        ],
      },
      { signal: controller.signal }
    )

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('No tool_use in judge response')
    }

    return {
      output: parseJudgeOutput(toolUse.input),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: ANTHROPIC_JUDGE_MODEL,
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function runOpenAIJudge(
  context: ReturnType<typeof buildJudgeContext>,
  desktopBase64: string | null,
  mobileBase64: string | null
): Promise<JudgeResult> {
  if (!openai) throw new Error('OPENAI_API_KEY is not configured')

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []
  if (desktopBase64) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${desktopBase64}`,
        detail: 'low',
      },
    })
  }
  // Mobile capture is intentional when both OpenAI and mobile screenshot exist.
  if (mobileBase64) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${mobileBase64}`,
        detail: 'low',
      },
    })
  }
  const screenshotHint =
    desktopBase64 && mobileBase64 ? 'desktop-and-mobile' : 'desktop-only'
  content.push({
    type: 'text',
    text: buildJudgePrompt({ ...context, screenshotHint }),
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OPENAI_JUDGE_TIMEOUT_MS)

  try {
    const response = await openai.chat.completions.create(
      {
        model: OPENAI_JUDGE_MODEL,
        max_tokens: OPENAI_MAX_TOKENS,
        messages: [{ role: 'user', content }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'quality_report',
              description: 'Output a structured quality audit report for a website',
              parameters: QUALITY_REPORT_SCHEMA,
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'quality_report' } },
      },
      { signal: controller.signal }
    )

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (!toolCall || toolCall.type !== 'function') {
      throw new Error('No function call in judge response')
    }

    const raw = JSON.parse(toolCall.function.arguments)
    return {
      output: parseJudgeOutput(raw),
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        model: OPENAI_JUDGE_MODEL,
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function runJudge(
  url: string,
  metadata: PageMetadata,
  desktop: PageSpeedResult | null,
  mobile: PageSpeedResult | null,
  flags: DeterministicFlag[],
  desktopBase64: string | null,
  mobileBase64: string | null
): Promise<JudgeResult> {
  const context = buildJudgeContext(url, metadata, desktop, mobile, flags)

  if (openai) {
    return runOpenAIJudge(context, desktopBase64, mobileBase64)
  }
  if (anthropic) {
    return runAnthropicJudge(context, desktopBase64, mobileBase64)
  }
  throw new Error('No LLM API key configured (set OPENAI_API_KEY or ANTHROPIC_API_KEY)')
}
