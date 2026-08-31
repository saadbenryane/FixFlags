import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import {
  triageOutputSchema,
  QUALITY_TRIAGE_SCHEMA_OPENAI,
  QUALITY_TRIAGE_TOOL,
  type TriageOutput,
} from './judge-triage-schema'
import { buildTriageSystemPrompt, buildTriageUserPrompt, type TriageContext } from '../prompts/system-prompt'
import { PageMetadata } from './metadata'
import { PageSpeedResult } from './pagespeed'
import { DeterministicFlag } from './checks'
import { getTriageProviderConfig } from './judge-config'
import { validateTriageOutput } from './validate-triage-output'
import { JudgeContractError } from './validate-judge-output'
import { isRetryableJudgeError } from './judge'
import { RUBRIC_ORDER } from './constants'
import {
  anthropic,
  openai,
  isProviderConfigured,
  runLlmWithRetry,
  type LlmUsage,
} from './judge-runner'

export type TriageUsage = LlmUsage

export interface TriageResult {
  output: TriageOutput
  usage: TriageUsage
}

export function isTriageProviderConfigured(): boolean {
  return isProviderConfigured()
}

function buildTriageContext(
  url: string,
  metadata: PageMetadata,
  desktop: PageSpeedResult | null,
  mobile: PageSpeedResult | null,
  flags: DeterministicFlag[],
  knownObservations?: TriageContext['knownObservations']
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
      hasPrivacyPolicy: metadata.hasPrivacyPolicy,
      hasContactInfo: metadata.hasContactInfo,
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
    knownObservations,
  }
}

function getScreenshotHint(desktopBase64: string | null, mobileBase64: string | null): 'no-screenshot' | 'desktop-only' | 'mobile-only' | 'desktop-and-mobile' {
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
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'quality_triage',
            strict: true,
            schema: QUALITY_TRIAGE_SCHEMA_OPENAI,
          },
        },
        messages: [
          { role: 'system', content: buildTriageSystemPrompt() },
          { role: 'user', content },
        ],
      },
      { signal: controller.signal }
    )

    const rawContent = response.choices[0]?.message?.content
    if (!rawContent) {
      throw new Error('No content in triage response')
    }

    const raw = JSON.parse(rawContent)
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
  maxTimeoutMs?: number,
  knownObservations?: TriageContext['knownObservations']
): Promise<TriageResult> {
  const context = buildTriageContext(
    url,
    metadata,
    desktop,
    mobile,
    flags,
    knownObservations
  )

  return runLlmWithRetry({
    label: 'triage',
    input: { context, flags, desktopBase64, mobileBase64, maxTimeoutMs },
    attemptFn: (provider, { context, flags, desktopBase64, mobileBase64, maxTimeoutMs }) =>
      runTriageWithProvider(provider, context, flags, desktopBase64, mobileBase64, maxTimeoutMs),
    isRetryable: isTriageAttemptRetryable,
  })
}
