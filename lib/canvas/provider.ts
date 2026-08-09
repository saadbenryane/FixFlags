import OpenAI from 'openai'
import { openai } from '@/lib/audit/judge-runner'
import { getChatProviderConfig } from '@/lib/audit/judge-config'
import { getOpenAIProviderKey } from '@/lib/audit/llm-keys'
import { getEnv } from '@/lib/env'
import type { CanvasEvidenceBundle, CanvasGenerator } from '@/lib/canvas/domain'
import type { CanvasGenerationUsage } from '@/lib/canvas/domain'

type OpenAIClient = NonNullable<typeof openai>

function getCanvasClient(): OpenAIClient | null {
  const baseURL = getEnv().CHAT_BASE_URL
  if (baseURL) {
    const key = getOpenAIProviderKey()
    return key ? new OpenAI({ apiKey: key, baseURL }) : null
  }
  return openai ?? null
}

export class CanvasProviderUnavailableError extends Error {
  constructor() {
    super('Canvas generation provider is unavailable')
    this.name = 'CanvasProviderUnavailableError'
  }
}

export function isCanvasGenerationConfigured(): boolean {
  return Boolean(getCanvasClient())
}

const SYSTEM = `You are FixFlags Canvas generation.
Create a concise visual report artifact using only the supplied verified evidence.
Return CanvasDocument schemaVersion 1 JSON. Never invent scores, Flags, evidence, or Product Memory.
Every factual block must cite sourceRefIds from the evidence bundle.
Use only these block types: score-summary, rubric-comparison, ranked-flags, evidence-gallery, before-after, product-memory, finish-plan, heading, text, callout.
Do not output HTML, JavaScript, CSS, URLs, data URLs, markdown links, or external resources.
Use capture reference IDs, Flag IDs, and memory reference IDs exactly as supplied.`

function providerInput(instruction: string, evidence: CanvasEvidenceBundle, previous: unknown): string {
  return JSON.stringify({ instruction, evidence, previous: previous ?? null })
}

export function canvasUsageFromProviderResponse(input: {
  model?: string | null
  configuredModel: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
    prompt_tokens_details?: { cached_tokens?: number }
  } | null
}): CanvasGenerationUsage {
  return {
    model: input.model || input.configuredModel,
    inputTokens: input.usage?.prompt_tokens ?? 0,
    outputTokens: input.usage?.completion_tokens ?? 0,
    cacheReadTokens: input.usage?.cache_read_input_tokens ?? input.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    cacheWriteTokens: input.usage?.cache_creation_input_tokens ?? 0,
  }
}

export const configuredCanvasGenerator: CanvasGenerator = {
  async generate({ instruction, evidence, previous }) {
    const client = getCanvasClient()
    if (!client) throw new CanvasProviderUnavailableError()
    const config = getChatProviderConfig('openai', 30_000)
    const response = await client.chat.completions.create({
      model: config.model,
      max_tokens: Math.min(config.maxTokens, 4_000),
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: providerInput(instruction, evidence, previous) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'fixflags_canvas_v1',
          // Runtime validation remains the hard strict gate. Some OpenAI-compatible
          // gateways do not support nested strict schemas with discriminated blocks.
          strict: false,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['schemaVersion', 'title', 'blocks'],
            properties: {
              schemaVersion: { type: 'integer', const: 1 },
              title: { type: 'string' },
              summary: { type: 'string' },
              blocks: {
                type: 'array',
                minItems: 1,
                maxItems: 40,
                items: {
                  type: 'object',
                  additionalProperties: true,
                  required: ['id', 'type', 'sourceRefIds'],
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string', enum: ['score-summary', 'rubric-comparison', 'ranked-flags', 'evidence-gallery', 'before-after', 'product-memory', 'finish-plan', 'heading', 'text', 'callout'] },
                    sourceRefIds: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    })
    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Canvas provider returned no document')
    const usage = response.usage as (typeof response.usage & {
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
      prompt_tokens_details?: { cached_tokens?: number }
    }) | undefined
    return {
      output: JSON.parse(content) as unknown,
      usage: canvasUsageFromProviderResponse({ model: response.model, configuredModel: config.model, usage }),
    }
  },
}
