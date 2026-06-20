import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import {
  judgeOutputSchema,
  QUALITY_REPORT_SCHEMA,
  QUALITY_REPORT_TOOL,
  type JudgeOutput,
} from './judge-schema'
import { buildJudgePrompt } from '../prompts/system-prompt'
import { PageMetadata } from './metadata'
import { PageSpeedResult } from './pagespeed'
import { DeterministicFlag } from './checks'
import { sanitizeJudgeOutput } from './sanitize-prompts'
import { normalizeJudgeRawOutput } from './validate-judge-output'

import { getProviderConfig, getJudgeProviderChain } from './judge-config'
import { logger } from '@/lib/logger'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

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

function parseJudgeOutput(raw: unknown, flags: DeterministicFlag[]): JudgeOutput {
  const normalized =
    typeof raw === 'object' && raw !== null
      ? normalizeJudgeRawOutput(raw as Record<string, unknown>, flags)
      : raw
  const parsed = judgeOutputSchema.safeParse(normalized)
  if (!parsed.success) {
    throw new Error(`Invalid judge output: ${parsed.error.message}`)
  }
  return sanitizeJudgeOutput(parsed.data) as JudgeOutput
}

async function runAnthropicJudge(
  context: ReturnType<typeof buildJudgeContext>,
  flags: DeterministicFlag[],
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

  const cfg = getProviderConfig('anthropic')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs)

  try {
    const response = await anthropic.messages.create(
      {
        model: cfg.model,
        max_tokens: cfg.maxTokens,
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
      output: parseJudgeOutput(toolUse.input, flags),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: cfg.model,
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function runOpenAIJudge(
  context: ReturnType<typeof buildJudgeContext>,
  flags: DeterministicFlag[],
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

  const cfg = getProviderConfig('openai')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs)

  try {
    const response = await openai.chat.completions.create(
      {
        model: cfg.model,
        max_tokens: cfg.maxTokens,
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
      output: parseJudgeOutput(raw, flags),
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        model: cfg.model,
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function runJudgeWithProvider(
  provider: string,
  context: ReturnType<typeof buildJudgeContext>,
  flags: DeterministicFlag[],
  desktopBase64: string | null,
  mobileBase64: string | null
): Promise<JudgeResult> {
  switch (provider) {
    case 'openai': {
      if (!openai) throw new Error('OPENAI_API_KEY is not configured')
      return runOpenAIJudge(context, flags, desktopBase64, mobileBase64)
    }
    case 'anthropic': {
      if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not configured')
      return runAnthropicJudge(context, flags, desktopBase64, mobileBase64)
    }
    default:
      throw new Error(`Unknown judge provider: ${provider}`)
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runJudgeWithRetry(
  url: string,
  metadata: PageMetadata,
  desktop: PageSpeedResult | null,
  mobile: PageSpeedResult | null,
  flags: DeterministicFlag[],
  desktopBase64: string | null,
  mobileBase64: string | null
): Promise<JudgeResult> {
  const context = buildJudgeContext(url, metadata, desktop, mobile, flags)
  const chain = getJudgeProviderChain()
  let lastError: Error | null = null

  for (const provider of chain) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await runJudgeWithProvider(
          provider,
          context,
          flags,
          desktopBase64,
          mobileBase64
        )
        logger.info('judge succeeded', { provider, attempt })
        return result
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        logger.warn('judge attempt failed', { provider, attempt, err: lastError.message })
        if (attempt < MAX_RETRIES && isRetryableJudgeError(err)) {
          await sleep(RETRY_DELAY_MS * attempt)
        }
      }
    }
  }

  throw lastError ?? new Error('Judge failed: no providers available')
}

/** @deprecated Use runJudgeWithRetry for automatic retry and provider fallback. */
export async function runJudge(
  url: string,
  metadata: PageMetadata,
  desktop: PageSpeedResult | null,
  mobile: PageSpeedResult | null,
  flags: DeterministicFlag[],
  desktopBase64: string | null,
  mobileBase64: string | null
): Promise<JudgeResult> {
  return runJudgeWithRetry(url, metadata, desktop, mobile, flags, desktopBase64, mobileBase64)
}
