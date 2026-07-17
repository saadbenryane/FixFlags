import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import {
  prescriptionOutputSchema,
  QUALITY_PRESCRIPTION_SCHEMA,
  QUALITY_PRESCRIPTION_TOOL,
  type PrescriptionOutput,
} from './judge-prescription-schema'
import {
  buildPrescriptionSystemPrompt,
  buildPrescriptionUserPrompt,
} from '../prompts/system-prompt'
import { PageMetadata } from './metadata'
import { getProviderConfig, getConfiguredJudgeProviderChain } from './judge-config'
import { JudgeContractError } from './validate-judge-output'
import { isRetryableJudgeError } from './judge'
import { logger } from '@/lib/logger'
import type { ExistingFlagForPrescription } from './flag-types'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

export interface PrescriptionUsage {
  inputTokens: number
  outputTokens: number
  model: string
  /** Prompt-cache tokens served from cache (Anthropic: cache_read_input_tokens). */
  cacheReadTokens?: number
  /** Prompt-cache tokens written to cache this call (Anthropic: cache_creation_input_tokens). */
  cacheWriteTokens?: number
}

export interface PrescriptionResult {
  output: PrescriptionOutput
  usage: PrescriptionUsage
}

export type { ExistingFlagForPrescription } from './flag-types'

export interface PrescriptionContext {
  url: string
  verdict: string
  score: number
  metadata: PageMetadata
  techStack: string[]
  existingFlags: ExistingFlagForPrescription[]
  rubrics: Array<{
    name: string
    grade: string
    score: number | null
    summary: string
  }>
}

function parsePrescriptionOutput(
  raw: unknown,
  existingFlags: ExistingFlagForPrescription[]
): PrescriptionOutput {
  const parsed = prescriptionOutputSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Invalid prescription output: ${parsed.error.message}`)
  }
  return validatePrescriptionOutput(parsed.data, existingFlags)
}

export function validatePrescriptionOutput(
  output: PrescriptionOutput,
  existingFlags: ExistingFlagForPrescription[]
): PrescriptionOutput {
  const requiredKeys = new Set(existingFlags.map((f) => f.flagKey))
  const providedKeys = output.flagPrescriptions.map((p) => p.flagKey)

  if (providedKeys.length !== requiredKeys.size) {
    throw new JudgeContractError(
      `expected ${requiredKeys.size} flag prescriptions, got ${providedKeys.length}`
    )
  }
  for (const key of requiredKeys) {
    if (!providedKeys.includes(key)) {
      throw new JudgeContractError(`missing prescription for flagKey ${key}`)
    }
  }

  if (output.rubricPrescriptions.length !== 3) {
    throw new JudgeContractError('expected exactly 3 rubric prescriptions')
  }

  // Quality gate: validate fix prompt specificity
  for (const rx of output.flagPrescriptions) {
    validateFixQuality(rx)
  }

  return output
}

function validateFixQuality(rx: {
  flagKey: string
  fix: string
  evidence: string
  whyItMatters: string
  agentPrompt?: string
  verificationRule: string
}): void {
  const fix = rx.fix.trim()

  // Fix must contain at least 2 lines (numbered steps or bullet points)
  const lines = fix.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    throw new JudgeContractError(
      `fix for ${rx.flagKey} must contain at least 2 numbered steps, got ${lines.length} line(s)`
    )
  }

  // Fix must contain concrete replacements (before/after pattern or specific selectors)
  const hasSpecificity =
    fix.includes('→') ||
    fix.includes('replace') ||
    fix.includes('change') ||
    fix.includes('update') ||
    fix.includes('add') ||
    fix.includes('remove') ||
    fix.includes('delete') ||
    fix.includes('set') ||
    fix.includes('href=') ||
    fix.includes('alt=') ||
    fix.includes('content=') ||
    fix.includes('class=') ||
    fix.includes('aria-') ||
    fix.includes('`') ||
    /\b(title|description|og:|meta|h1|h2|button|link|nav|header|footer|section|img|input|form)\b/i.test(fix)
  if (!hasSpecificity) {
    throw new JudgeContractError(
      `fix for ${rx.flagKey} lacks specificity: must include element selectors, attribute names, or before/after text`
    )
  }

  // Evidence must reference something concrete on the page
  const evidence = rx.evidence.trim()
  if (evidence.length < 20) {
    throw new JudgeContractError(
      `evidence for ${rx.flagKey} is too brief (${evidence.length} chars), must describe what is visible on the page`
    )
  }

  // WhyItMatters must explain business impact, not just technical description
  const why = rx.whyItMatters.trim()
  if (why.length < 15) {
    throw new JudgeContractError(
      `whyItMatters for ${rx.flagKey} is too brief (${why.length} chars), must explain real-world impact`
    )
  }

  // Verification rule must be checkable
  const vr = rx.verificationRule.trim()
  if (vr.length < 10) {
    throw new JudgeContractError(
      `verificationRule for ${rx.flagKey} is too brief (${vr.length} chars), must describe how to verify the fix`
    )
  }
}

async function runAnthropicPrescription(
  context: PrescriptionContext,
  desktopBase64: string | null,
  mobileBase64: string | null,
  maxTimeoutMs?: number
): Promise<PrescriptionResult> {
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

  const cfg = getProviderConfig('anthropic', maxTimeoutMs)
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
            text: buildPrescriptionSystemPrompt(),
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [QUALITY_PRESCRIPTION_TOOL],
        tool_choice: { type: 'tool', name: 'quality_prescription' },
        messages: [
          {
            role: 'user',
            content: [
              ...imageContent,
              {
                type: 'text',
                text: buildPrescriptionUserPrompt({
                  url: context.url,
                  pageText: context.metadata.pageText,
                  verdict: context.verdict,
                  score: context.score,
                  metadata: {
                    title: context.metadata.title,
                    description: context.metadata.description,
                    h1s: context.metadata.h1s,
                    h2s: context.metadata.h2s,
                    ctaTexts: context.metadata.ctaTexts,
                  },
                  techStack: context.techStack,
                  existingFlags: context.existingFlags,
                  rubrics: context.rubrics,
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
      throw new Error('No tool_use in prescription response')
    }

    return {
      output: parsePrescriptionOutput(toolUse.input, context.existingFlags),
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

async function runOpenAIPrescription(
  context: PrescriptionContext,
  desktopBase64: string | null,
  mobileBase64: string | null,
  maxTimeoutMs?: number
): Promise<PrescriptionResult> {
  if (!openai) throw new Error('OPENAI_API_KEY is not configured')

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []
  if (desktopBase64) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${desktopBase64}`, detail: 'low' },
    })
  }
  if (mobileBase64) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${mobileBase64}`, detail: 'low' },
    })
  }
  const screenshotHint =
    desktopBase64 && mobileBase64 ? 'desktop-and-mobile' : 'desktop-only'
  content.push({
    type: 'text',
    text: buildPrescriptionUserPrompt({
      url: context.url,
      pageText: context.metadata.pageText,
      verdict: context.verdict,
      score: context.score,
      metadata: {
        title: context.metadata.title,
        description: context.metadata.description,
        h1s: context.metadata.h1s,
        h2s: context.metadata.h2s,
        ctaTexts: context.metadata.ctaTexts,
      },
      techStack: context.techStack,
      existingFlags: context.existingFlags,
      rubrics: context.rubrics,
      screenshotHint,
    }),
  })

  const cfg = getProviderConfig('openai', maxTimeoutMs)
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
          { role: 'system', content: buildPrescriptionSystemPrompt() },
          { role: 'user', content },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'quality_prescription',
              description: 'Generate fix prompts for an already-diagnosed audit',
              parameters: QUALITY_PRESCRIPTION_SCHEMA,
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'quality_prescription' } },
      },
      { signal: controller.signal }
    )

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (!toolCall || toolCall.type !== 'function') {
      throw new Error('No function call in prescription response')
    }

    const raw = JSON.parse(toolCall.function.arguments)
    return {
      output: parsePrescriptionOutput(raw, context.existingFlags),
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

async function runPrescriptionWithProvider(
  provider: string,
  context: PrescriptionContext,
  desktopBase64: string | null,
  mobileBase64: string | null,
  maxTimeoutMs?: number
): Promise<PrescriptionResult> {
  switch (provider) {
    case 'openai':
      return runOpenAIPrescription(context, desktopBase64, mobileBase64, maxTimeoutMs)
    case 'anthropic':
      return runAnthropicPrescription(context, desktopBase64, mobileBase64, maxTimeoutMs)
    default:
      throw new Error(`Unknown prescription provider: ${provider}`)
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isPrescriptionAttemptRetryable(err: unknown): boolean {
  return (
    isRetryableJudgeError(err) ||
    err instanceof JudgeContractError ||
    (err instanceof Error && err.message.startsWith('Invalid prescription output:'))
  )
}

export async function runPrescriptionWithRetry(
  context: PrescriptionContext,
  desktopBase64: string | null,
  mobileBase64: string | null,
  maxTimeoutMs?: number
): Promise<PrescriptionResult> {
  const chain = getConfiguredJudgeProviderChain()
  if (chain.length === 0) {
    throw new Error('No AI provider keys configured')
  }

  let lastError: Error | null = null

  for (const provider of chain) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await runPrescriptionWithProvider(
          provider,
          context,
          desktopBase64,
          mobileBase64,
          maxTimeoutMs
        )
        logger.info('prescription succeeded', { provider, attempt })
        return result
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        logger.warn('prescription attempt failed', { provider, attempt, err: lastError.message })
        if (!isPrescriptionAttemptRetryable(err)) break
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt)
        }
      }
    }
  }

  throw lastError ?? new Error('Prescription failed: no providers available')
}
