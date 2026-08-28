import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import {
  prescriptionOutputSchema,
  QUALITY_PRESCRIPTION_TOOL,
  QUALITY_PRESCRIPTION_SCHEMA_OPENAI,
  type PrescriptionOutput,
} from './judge-prescription-schema'
import {
  buildPrescriptionSystemPrompt,
  buildPrescriptionUserPrompt,
} from '../prompts/system-prompt'
import { PageMetadata } from './metadata'
import { getProviderConfig } from './judge-config'
import { JudgeContractError } from './validate-judge-output'
import { isRetryableJudgeError } from './judge'
import type { ExistingFlagForPrescription } from './flag-types'
import {
  anthropic,
  openai,
  runLlmWithRetry,
  type LlmUsage,
} from './judge-runner'

export type PrescriptionUsage = LlmUsage

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

  for (const rx of output.flagPrescriptions) {
    const existing = existingFlags.find((f) => f.flagKey === rx.flagKey)
    validateFixQuality(rx, existing)
    // Soft-fail mismatched agentPrompt: keep fix/evidence, drop the bad prompt
    // so the whole prescription job is not aborted after retries.
    const agentPrompt = rx.agentPrompt?.trim()
    if (
      existing &&
      agentPrompt &&
      agentPrompt.length > 0 &&
      !sharesEvidenceTokens(agentPrompt, existing.problem, existing.evidence)
    ) {
      rx.agentPrompt = null
    }
  }

  return output
}

function tokenizeForOverlap(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .match(/[a-z0-9]{3,}/g)
  return new Set(tokens ?? [])
}

function sharesEvidenceTokens(
  prompt: string,
  problem: string,
  evidence: string
): boolean {
  const promptTokens = tokenizeForOverlap(prompt)
  if (promptTokens.size === 0) return false
  const sourceTokens = tokenizeForOverlap(`${problem} ${evidence}`)
  let overlap = 0
  for (const t of promptTokens) {
    if (sourceTokens.has(t)) overlap += 1
  }
  // Require a few shared content tokens so ARIA-heavy prompts cannot pass
  // when the finding is about an unrelated topic.
  return overlap >= 2
}

function validateFixQuality(
  rx: {
    flagKey: string
    fix: string
    evidence: string
    whyItMatters: string
    agentPrompt?: string | null
    verificationRule: string
  },
  existing?: ExistingFlagForPrescription
): void {
  const fix = rx.fix.trim()

  const lines = fix.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    throw new JudgeContractError(
      `fix for ${rx.flagKey} must contain at least 2 numbered steps, got ${lines.length} line(s)`
    )
  }

  const findingLooksLikeA11yInteraction =
    existing != null &&
    /\b(keyboard|aria-|screen\s+reader|focus|tabindex|accessible\s+name)\b/i.test(
      `${existing.problem} ${existing.evidence}`
    )

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
    (fix.includes('aria-') && findingLooksLikeA11yInteraction) ||
    fix.includes('`') ||
    /\b(title|description|og:|meta|h1|h2|button|link|nav|header|footer|section|img|input|form)\b/i.test(
      fix
    )
  if (!hasSpecificity) {
    throw new JudgeContractError(
      `fix for ${rx.flagKey} lacks specificity: must include element selectors, attribute names, or before/after text`
    )
  }

  const evidence = rx.evidence.trim()
  if (evidence.length < 20) {
    throw new JudgeContractError(
      `evidence for ${rx.flagKey} is too brief (${evidence.length} chars), must describe what is visible on the page`
    )
  }

  const why = rx.whyItMatters.trim()
  if (why.length < 15) {
    throw new JudgeContractError(
      `whyItMatters for ${rx.flagKey} is too brief (${why.length} chars), must explain real-world impact`
    )
  }

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
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'quality_prescription',
            strict: true,
            schema: QUALITY_PRESCRIPTION_SCHEMA_OPENAI,
          },
        },
        messages: [
          { role: 'system', content: buildPrescriptionSystemPrompt() },
          { role: 'user', content },
        ],
      },
      { signal: controller.signal }
    )

    const rawContent = response.choices[0]?.message?.content
    if (!rawContent) {
      throw new Error('No content in prescription response')
    }

    const raw = JSON.parse(rawContent)
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

function isPrescriptionAttemptRetryable(err: unknown): boolean {
  return (
    isRetryableJudgeError(err) ||
    err instanceof JudgeContractError ||
    (err instanceof Error && err.message.startsWith('Invalid prescription output:'))
  )
}

const PRESCRIPTION_BATCH_SIZE = 12

function chunkFlags<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]]
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

async function runPrescriptionBatch(
  context: PrescriptionContext,
  desktopBase64: string | null,
  mobileBase64: string | null,
  maxTimeoutMs?: number
): Promise<PrescriptionResult> {
  return runLlmWithRetry({
    label: 'prescription',
    input: { context, desktopBase64, mobileBase64, maxTimeoutMs },
    attemptFn: (provider, { context, desktopBase64, mobileBase64, maxTimeoutMs }) =>
      runPrescriptionWithProvider(provider, context, desktopBase64, mobileBase64, maxTimeoutMs),
    isRetryable: isPrescriptionAttemptRetryable,
  })
}

export async function runPrescriptionWithRetry(
  context: PrescriptionContext,
  desktopBase64: string | null,
  mobileBase64: string | null,
  maxTimeoutMs?: number
): Promise<PrescriptionResult> {
  const flags = context.existingFlags
  if (flags.length <= PRESCRIPTION_BATCH_SIZE) {
    return runPrescriptionBatch(context, desktopBase64, mobileBase64, maxTimeoutMs)
  }

  const batches = chunkFlags(flags, PRESCRIPTION_BATCH_SIZE)
  const flagPrescriptions: PrescriptionOutput['flagPrescriptions'] = []
  let rubricPrescriptions: PrescriptionOutput['rubricPrescriptions'] = []
  let inputTokens = 0
  let outputTokens = 0
  let model = ''

  for (const batch of batches) {
    const batchContext: PrescriptionContext = {
      ...context,
      existingFlags: batch,
    }
    const result = await runPrescriptionBatch(
      batchContext,
      desktopBase64,
      mobileBase64,
      maxTimeoutMs
    )
    flagPrescriptions.push(...result.output.flagPrescriptions)
    if (rubricPrescriptions.length === 0) {
      rubricPrescriptions = result.output.rubricPrescriptions
    }
    inputTokens += result.usage.inputTokens
    outputTokens += result.usage.outputTokens
    model = result.usage.model
  }

  const merged = validatePrescriptionOutput(
    { flagPrescriptions, rubricPrescriptions },
    flags
  )
  return {
    output: merged,
    usage: { inputTokens, outputTokens, model },
  }
}
