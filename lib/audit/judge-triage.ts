import { measuredProviderRequest, openAIResponseUsage, anthropicResponseUsage } from './provider-request'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { ProviderUsageAdmission } from './provider-usage'
import {
  triageProviderOutputSchema,
  triageOutputSchema,
  QUALITY_TRIAGE_SCHEMA_OPENAI,
  QUALITY_TRIAGE_TOOL,
  type TriageOutput,
} from './judge-triage-schema'
import { buildTriageSystemPrompt, buildTriageUserPrompt, type TriageContext } from '../prompts/system-prompt'
import { PageMetadata } from './metadata'
import { PageSpeedResult } from './pagespeed'
import { DeterministicFlag } from './checks'
import { getTriageProviderConfig, type ProviderConfig } from './judge-config'
import { createHash } from 'node:crypto'
import { getScreenshotHint } from './screenshot-hint'
import { assessTriageRecommendations, triageAssessmentSchema, type TriageAssessment } from './triage-grounding'
import { validateTriageOutput } from './validate-triage-output'
import { JudgeContractError } from './validate-judge-output'
import { isRetryableJudgeError } from './judge'
import { RUBRIC_ORDER } from './constants'
import { detectPagePurpose } from './page-purpose'
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
  assessment?: TriageAssessment
}

export function reusableTriageInterpretation(result: TriageResult, configurations: readonly { provider: string; model: string }[]) {
  return result.assessment?.status === 'COMPLETE' && result.output.rubrics.every(rubric => rubric.assessmentState === 'ASSESSED')
    && configurations.some(config => config.provider === result.usage.provider && config.model === result.usage.model)
}

/** Re-run current grounding and policy before a retained interpretation can
 * attach to a fresh observation. Original provider consumption is not replayed. */
export function revalidateTriageInterpretation(value: unknown, context: TriageContext, flags: DeterministicFlag[]): TriageResult | null {
  if (!value || typeof value !== 'object') return null
  const recorded = value as TriageResult
  const parsed = triageOutputSchema.safeParse(recorded.output)
  const assessment = triageAssessmentSchema.safeParse(recorded.assessment)
  if (!parsed.success || !assessment.success || assessment.data.status !== 'COMPLETE') return null
  const grounded = assessTriageRecommendations(parsed.data.newFlags, context)
  if (grounded.assessment.status !== 'COMPLETE') return null
  const output = validateTriageOutput(parsed.data, flags, context.pagePurpose?.purpose ?? 'unknown', context)
  if (output.newFlags.length !== parsed.data.newFlags.length) return null
  return { output, assessment: assessment.data, usage: { inputTokens: 0, outputTokens: 0, model: recorded.usage?.model ?? 'reused' } }
}

export function isTriageProviderConfigured(): boolean {
  return isProviderConfigured()
}

export function buildTriageContext(
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
    pagePurpose: detectPagePurpose(metadata, url),
    knownObservations,
  }
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

function parseTriageOutput(
  raw: unknown,
  flags: DeterministicFlag[],
  pagePurpose: ReturnType<typeof detectPagePurpose>['purpose'],
  context: TriageContext
): Pick<TriageResult, 'output' | 'assessment'> {
  const parsed = triageProviderOutputSchema.safeParse(normalizeTriageRawOutput(raw))
  if (!parsed.success) {
    throw new Error(`Invalid triage output: ${parsed.error.message}`)
  }
  const { assessment } = assessTriageRecommendations(parsed.data.newFlags, context)
  const scoped = { ...parsed.data, newFlags: parsed.data.newFlags.map(flag => ({ ...flag, pageUrl: context.url })) }
  const output = validateTriageOutput(scoped, flags, pagePurpose, context)
  return { output,
    assessment: { ...assessment, admittedCount: output.newFlags.length, rubrics: parsed.data.rubrics, verdict: parsed.data.verdict } }
}

function anthropicTriageRequest(context: ReturnType<typeof buildTriageContext>, desktopBase64: string | null, mobileBase64: string | null, cfg: ProviderConfig) {
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
  return {
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
  } satisfies Parameters<NonNullable<typeof anthropic>['messages']['create']>[0]
}

function openAITriageRequest(context: ReturnType<typeof buildTriageContext>, desktopBase64: string | null, mobileBase64: string | null, cfg: ProviderConfig) {
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
  return {
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
  } satisfies Parameters<NonNullable<typeof openai>['chat']['completions']['create']>[0]
}

/** These digests use the very same request builders as SDK dispatch. Native
 * receipt IDs and unused provider timestamps cannot invalidate interpretation. */
export function triageInterpretationRequestDigests(context: ReturnType<typeof buildTriageContext>, desktopBase64: string | null,
  mobileBase64: string | null, configurations: readonly (ProviderConfig & { provider: string })[]) {
  return configurations.map(config => {
    const body = config.provider === 'openai' ? openAITriageRequest(context, desktopBase64, mobileBase64, config)
      : config.provider === 'anthropic' ? anthropicTriageRequest(context, desktopBase64, mobileBase64, config) : null
    if (!body) throw new Error('Unknown triage provider: ' + config.provider)
    return { provider: config.provider, model: config.model, bodySha256: createHash('sha256').update(JSON.stringify(body)).digest('hex') }
  })
}

async function runAnthropicTriage(
  context: ReturnType<typeof buildTriageContext>,
  flags: DeterministicFlag[],
  desktopBase64: string | null,
  mobileBase64: string | null,
  maxTimeoutMs?: number,
  onAttempt?: ProviderUsageAdmission
): Promise<TriageResult> {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not configured')
  const client = anthropic

  const cfg = getTriageProviderConfig('anthropic', maxTimeoutMs)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs)

  try {
    const requestBody = anthropicTriageRequest(context, desktopBase64, mobileBase64, cfg)
    const { response, usage } = await measuredProviderRequest({
      api: 'messages', requestBody,
      model: cfg.model, onAttempt,
      request: () => client.messages.create(requestBody, { signal: controller.signal }),
      usage: response => anthropicResponseUsage(response, cfg.model),
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('No tool_use in triage response')
    }

    return {
      ...parseTriageOutput(toolUse.input, flags, context.pagePurpose?.purpose ?? 'unknown', { ...context, screenshotHint: getScreenshotHint(desktopBase64, mobileBase64) }),
      usage: usage ?? { inputTokens: 0, outputTokens: 0, model: cfg.model },
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
  maxTimeoutMs?: number,
  onAttempt?: ProviderUsageAdmission
): Promise<TriageResult> {
  if (!openai) throw new Error('OPENAI_API_KEY is not configured')
  const client = openai

  const cfg = getTriageProviderConfig('openai', maxTimeoutMs)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs)

  try {
    const requestBody = openAITriageRequest(context, desktopBase64, mobileBase64, cfg)
    const { response, usage } = await measuredProviderRequest({
      api: 'chat.completions', requestBody,
      model: cfg.model, onAttempt,
      request: () => client.chat.completions.create(requestBody, { signal: controller.signal }),
      usage: response => openAIResponseUsage(response, cfg.model),
    })

    const rawContent = response.choices[0]?.message?.content
    if (!rawContent) {
      throw new Error('No content in triage response')
    }

    const raw = JSON.parse(rawContent)
    return {
      ...parseTriageOutput(raw, flags, context.pagePurpose?.purpose ?? 'unknown', { ...context, screenshotHint: getScreenshotHint(desktopBase64, mobileBase64) }),
      usage: usage ?? { inputTokens: 0, outputTokens: 0, model: cfg.model },
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
  maxTimeoutMs?: number,
  onAttempt?: ProviderUsageAdmission
): Promise<TriageResult> {
  switch (provider) {
    case 'openai':
      if (!openai) throw new Error('OPENAI_API_KEY is not configured')
      return runOpenAITriage(context, flags, desktopBase64, mobileBase64, maxTimeoutMs, onAttempt)
    case 'anthropic':
      if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not configured')
      return runAnthropicTriage(context, flags, desktopBase64, mobileBase64, maxTimeoutMs, onAttempt)
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
  knownObservations?: TriageContext['knownObservations'],
  onAttempt?: ProviderUsageAdmission
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
    input: { context, flags, desktopBase64, mobileBase64, maxTimeoutMs, onAttempt },
    attemptFn: (provider, { context, flags, desktopBase64, mobileBase64, maxTimeoutMs, onAttempt }) =>
      runTriageWithProvider(provider, context, flags, desktopBase64, mobileBase64, maxTimeoutMs, onAttempt),
    isRetryable: isTriageAttemptRetryable,
  })
}
