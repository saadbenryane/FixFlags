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
import { DeterministicFinding } from './checks'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const judgeOutputSchema = z.object({
  pageJob: z.string(),
  pageType: z.string(),
  verdict: z.string(),
  score: z.number(),
  launchReadiness: z.enum(['safe', 'fix_first', 'not_ready']),
  launchChecklist: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      passed: z.boolean(),
    })
  ),
  areas: z.array(
    z.object({
      name: z.string(),
      score: z.number().nullable().optional(),
      grade: z.string(),
      status: z.string(),
      summary: z.string(),
      areaPrompt: z.string(),
      cursorPrompt: z.string().optional(),
      claudePrompt: z.string().optional(),
      lovablePrompt: z.string().optional(),
      boltPrompt: z.string().optional(),
    })
  ),
  newFindings: z.array(
    z.object({
      area: z.string(),
      severity: z.string(),
      problem: z.string(),
      evidence: z.string(),
      whyItMatters: z.string(),
      fix: z.string(),
      confidence: z.number(),
      agentPrompt: z.string().optional(),
      cursorPrompt: z.string().optional(),
      claudePrompt: z.string().optional(),
      lovablePrompt: z.string().optional(),
      boltPrompt: z.string().optional(),
      verificationRule: z.string().optional(),
    })
  ),
  enrichments: z.array(
    z.object({
      checkId: z.string(),
      whyItMatters: z.string(),
      agentPrompt: z.string().optional(),
      cursorPrompt: z.string().optional(),
      claudePrompt: z.string().optional(),
      lovablePrompt: z.string().optional(),
      boltPrompt: z.string().optional(),
      verificationRule: z.string().optional(),
    })
  ),
})

export type JudgeOutput = z.infer<typeof judgeOutputSchema>

const ANTHROPIC_JUDGE_MODEL = 'claude-sonnet-4-6'
const OPENAI_JUDGE_MODEL = 'gpt-4o-mini'
const ANTHROPIC_MAX_TOKENS = 8192
const OPENAI_MAX_TOKENS = 4096

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
  findings: DeterministicFinding[]
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
    deterministicFindings: findings.map((f) => ({
      checkId: f.checkId,
      problem: f.problem,
      evidence: f.evidence,
      area: f.area,
      severity: f.severity,
    })),
  }
}

function normalizeJudgeOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const data = raw as Record<string, unknown>
  if (!Array.isArray(data.areas)) return raw

  return {
    ...data,
    newFindings: Array.isArray(data.newFindings) ? data.newFindings : [],
    enrichments: Array.isArray(data.enrichments) ? data.enrichments : [],
    areas: data.areas.map((area) => {
      if (!area || typeof area !== 'object') return area
      const row = area as Record<string, unknown>
      return row.score === null ? { ...row, score: undefined } : row
    }),
  }
}

function parseJudgeOutput(raw: unknown): JudgeOutput {
  const parsed = judgeOutputSchema.safeParse(normalizeJudgeOutput(raw))
  if (!parsed.success) {
    throw new Error(`Invalid judge output: ${parsed.error.message}`)
  }
  return parsed.data
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
      source: { type: 'base64', media_type: 'image/webp', data: desktopBase64 },
    })
  }
  if (mobileBase64) {
    imageContent.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/webp', data: mobileBase64 },
    })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)

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
        url: `data:image/webp;base64,${desktopBase64}`,
        detail: 'low',
      },
    })
  }
  // Mobile capture is intentional when both OpenAI and mobile screenshot exist.
  if (mobileBase64) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/webp;base64,${mobileBase64}`,
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
  const timeout = setTimeout(() => controller.abort(), 45_000)

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
  findings: DeterministicFinding[],
  desktopBase64: string | null,
  mobileBase64: string | null
): Promise<JudgeResult> {
  const context = buildJudgeContext(url, metadata, desktop, mobile, findings)

  if (openai) {
    return runOpenAIJudge(context, desktopBase64, mobileBase64)
  }
  if (anthropic) {
    return runAnthropicJudge(context, desktopBase64, mobileBase64)
  }
  throw new Error('No LLM API key configured (set OPENAI_API_KEY or ANTHROPIC_API_KEY)')
}
