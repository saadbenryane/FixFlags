import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import {
  triageOutputSchema,
  QUALITY_TRIAGE_SCHEMA_OPENAI,
  QUALITY_TRIAGE_TOOL,
  type TriageOutput,
} from './judge-triage-schema'
import { buildTriageSystemPrompt, buildTriageUserPrompt } from '../prompts/system-prompt'
import { PageMetadata } from './metadata'
import { PageSpeedResult } from './pagespeed'
import { DeterministicFlag } from './checks'
import { getTriageProviderConfig, getConfiguredJudgeProviderChain } from './judge-config'
import { validateTriageOutput } from './validate-triage-output'
import { JudgeContractError } from './validate-judge-output'
import { isRetryableJudgeError } from './judge'
import { logger } from '@/lib/logger'
import { RUBRIC_ORDER } from './constants'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000
type ScreenshotHint = 'no-screenshot' | 'desktop-only' | 'mobile-only' | 'desktop-and-mobile'

export interface TriageUsage {
  inputTokens: number
  outputTokens: number
  model: string
  /** Prompt-cache tokens served from cache (Anthropic: cache_read_input_tokens). */
  cacheReadTokens?: number
  /** Prompt-cache tokens written to cache this call (Anthropic: cache_creation_input_tokens). */
  cacheWriteTokens?: number
}

export interface TriageResult {
  output: TriageOutput
  usage: TriageUsage
}

function buildTriageContext(
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

function getScreenshotHint(desktopBase64: string | null, mobileBase64: string | null): ScreenshotHint {
  if (desktopBase64 && mobileBase64) return 'desktop-and-mobile'
  if (desktopBase64) return 'desktop-only'
  if (mobileBase64) return 'mobile-only'
  return 'no-screenshot'
}

export function normalizeTriageRawOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw

  const normalized = { ...(raw as Record<string, unknown>) }
  const rubrics = Array.isArray(normalized.rubrics)
    ? (normalized.rubrics as Array<Record<string, unknown>>)
    : []
  const byName = new Map<string, Record<string, unknown>>()

  for (const rubric of rubrics) {
    if (!rubric || typeof rubric !== 'object') continue
    const name = typeof rubric.name === 'string' ? rubric.name : null
    if (!name || byName.has(name)) continue

    const assessmentState = rubric.assessmentState
    byName.set(name, {
      ...rubric,
      score: assessmentState === 'ASSESSED' ? rubric.score : null,
    })
  }

  normalized.rubrics = RUBRIC_ORDER.map((name) => {
    const rubric = byName.get(name)
    if (rubric) return rubric

    return {
      name,
      score: null,
      grade: 'F',
      status: 'NEEDS_WORK',
      assessmentState: 'UNKNOWN',
      confidence: 0,
      summary: `Not enough captured evidence to assess ${name}.`,
    }
  })

  return normalized
}

function parseTriageOutput(raw: unknown, flags: DeterministicFlag[]): TriageOutput {
  const parsed = triageOutputSchema.safeParse(normalizeTriageRawOutput(raw))
  if (!parsed.success) {
    throw new Error(`Invalid triage output: ${parsed.error.message}`)
  }
  return validateTriageOutput(parsed.data, flags)
}

async function runAnthropicTriage(
  context: ReturnType<typeof buildTriageContext>,
  flags: DeterministicFlag[],
  desktopBase64: string | null,
  mobileBase64: string | null,
  maxTimeoutMs?: number
): Promise<TriageResult> {
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

  const cfg = getTriageProviderConfig('anthropic', maxTimeoutMs)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs)

  try {
    const response = await anthropic.messages.create(
      {
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        // Stable instructions live in `system` with a cache breakpoint so the
        // tools + system prefix is prompt-cached across audits (~0.1x on reads).
        system: [
          {
            type: 'text',
            text: buildTriageSystemPrompt(),
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [QUALITY_TRIAGE_TOOL],
        tool_choice: { type: 'tool', name: 'quality_triage' },
        messages: [
          {
            role: 'user',
            content: [
              ...imageContent,
              {
                type: 'text',
                text: buildTriageUserPrompt({
                  ...context,
                  screenshotHint: getScreenshotHint(desktopBase64, mobileBase64),
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
      throw new Error('No tool_use in triage response')
    }

    return {
      output: parseTriageOutput(toolUse.input, flags),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: cfg.model,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function runOpenAITriage(
  context: ReturnType<typeof buildTriageContext>,
  flags: DeterministicFlag[],
  desktopBase64: string | null,
  mobileBase64: string | null,
  maxTimeoutMs?: number
): Promise<TriageResult> {
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
  if (mobileBase64) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${mobileBase64}`,
        detail: 'low',
      },
    })
  }
  content.push({
    type: 'text',
    text: buildTriageUserPrompt({
      ...context,
      screenshotHint: getScreenshotHint(desktopBase64, mobileBase64),
    }),
  })

  const cfg = getTriageProviderConfig('openai', maxTimeoutMs)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs)

  try {
    const response = await openai.chat.completions.create(
      {
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        // System-first ordering makes the stable instruction block the cacheable
        // prefix for OpenAI's automatic prompt caching (~0.5x on cached input).
        messages: [
          { role: 'system', content: buildTriageSystemPrompt() },
          { role: 'user', content },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'quality_triage',
              description: 'Output a fast quality triage for a website',
              parameters: QUALITY_TRIAGE_SCHEMA_OPENAI,
              strict: true,
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'quality_triage' } },
      },
      { signal: controller.signal }
    )

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (!toolCall || toolCall.type !== 'function') {
      throw new Error('No function call in triage response')
    }

    const raw = JSON.parse(toolCall.function.arguments)
    return {
      output: parseTriageOutput(raw, flags),
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

async function runTriageWithProvider(
  provider: string,
  context: ReturnType<typeof buildTriageContext>,
  flags: DeterministicFlag[],
  desktopBase64: string | null,
  mobileBase64: string | null,
  maxTimeoutMs?: number
): Promise<TriageResult> {
  switch (provider) {
    case 'openai':
      if (!openai) throw new Error('OPENAI_API_KEY is not configured')
      return runOpenAITriage(context, flags, desktopBase64, mobileBase64, maxTimeoutMs)
    case 'anthropic':
      if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not configured')
      return runAnthropicTriage(context, flags, desktopBase64, mobileBase64, maxTimeoutMs)
    default:
      throw new Error(`Unknown triage provider: ${provider}`)
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTriageAttemptRetryable(err: unknown): boolean {
  return (
    isRetryableJudgeError(err) ||
    err instanceof JudgeContractError ||
    (err instanceof Error && err.message.startsWith('Invalid triage output:'))
  )
}

export async function runTriageWithRetry(
  url: string,
  metadata: PageMetadata,
  desktop: PageSpeedResult | null,
  mobile: PageSpeedResult | null,
  flags: DeterministicFlag[],
  desktopBase64: string | null,
  mobileBase64: string | null,
  maxTimeoutMs?: number
): Promise<TriageResult> {
  const context = buildTriageContext(url, metadata, desktop, mobile, flags)
  const chain = getConfiguredJudgeProviderChain()
  if (chain.length === 0) {
    throw new Error('No AI provider keys configured')
  }

  const attemptErrors: string[] = []
  let lastError: Error | null = null

  for (const provider of chain) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await runTriageWithProvider(
          provider,
          context,
          flags,
          desktopBase64,
          mobileBase64,
          maxTimeoutMs
        )
        logger.info('triage succeeded', { provider, attempt })
        return result
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        attemptErrors.push(`${provider}#${attempt}: ${lastError.message}`)
        logger.warn('triage attempt failed', { provider, attempt, err: lastError.message })
        if (!isTriageAttemptRetryable(err)) break
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt)
        }
      }
    }
  }

  const detail = attemptErrors.length > 0 ? attemptErrors.join('; ') : 'no attempts recorded'
  throw lastError ?? new Error(`Triage failed: ${detail}`)
}
