import { z } from 'zod'
import type { ProviderUsageAdmission } from './provider-usage'

const tokens = z.number().int().nonnegative()
export const llmUsageSchema = z.object({
  model: z.string().min(1).max(200), inputTokens: tokens, outputTokens: tokens,
  cacheReadTokens: tokens.optional(), cacheWriteTokens: tokens.optional(),
  provider: z.enum(['openai', 'anthropic']).optional(),
  api: z.enum(['chat.completions', 'messages']).optional(),
  serviceTier: z.string().min(1).max(100).optional(),
  providerResponseId: z.string().min(1).max(200).optional(),
  reasoningTokens: tokens.optional(),
}).strict()

export type LlmUsage = z.infer<typeof llmUsageSchema>

/** Measure the response before parsing its generated content. */
export async function measuredProviderRequest<T>(options: {
  model: string
  onAttempt?: ProviderUsageAdmission
  request: () => PromiseLike<T>
  usage: (response: T) => LlmUsage | null
}): Promise<{ response: T; usage: LlmUsage | null }> {
  const record = await options.onAttempt?.(options.model)
  let response: T
  try { response = await options.request() } catch (error) { await record?.(null); throw error }
  const usage = options.usage(response)
  await record?.(usage)
  return { response, usage }
}

export function openAIResponseUsage(response: { id?: string; model?: string; service_tier?: string | null; usage?: {
  prompt_tokens: number; completion_tokens: number;
  prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number } | null
  completion_tokens_details?: { reasoning_tokens?: number } | null
} | null }, model: string): LlmUsage | null {
  if (!response.usage) return null
  const { prompt_tokens: input, completion_tokens: output } = response.usage
  const cached = response.usage.prompt_tokens_details?.cached_tokens ?? 0
  const written = response.usage.prompt_tokens_details?.cache_write_tokens ?? 0
  const reasoning = response.usage.completion_tokens_details?.reasoning_tokens
  if (![input, output, cached, written, ...(reasoning === undefined ? [] : [reasoning])]
    .every(value => Number.isSafeInteger(value) && value >= 0) || cached + written > input || (reasoning ?? 0) > output) return null
  const parsed = llmUsageSchema.safeParse({ inputTokens: input - cached - written, outputTokens: output,
    cacheReadTokens: cached, cacheWriteTokens: written, model: response.model ?? model,
    provider: 'openai', api: 'chat.completions', serviceTier: response.service_tier ?? 'unknown',
    ...(response.id ? { providerResponseId: response.id } : {}),
    ...(reasoning === undefined ? {} : { reasoningTokens: reasoning }) })
  return parsed.success ? parsed.data : null
}

export function anthropicResponseUsage(response: { id?: string; model?: string; usage?: {
  input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null
  service_tier?: string | null
} | null }, model: string): LlmUsage | null {
  if (!response.usage) return null
  const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0, cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0 }
  if (!Object.values(usage).every(value => Number.isSafeInteger(value) && value >= 0)) return null
  const parsed = llmUsageSchema.safeParse({ ...usage, model: response.model ?? model, provider: 'anthropic', api: 'messages',
    serviceTier: response.usage.service_tier ?? 'unknown',
    ...(response.id ? { providerResponseId: response.id } : {}) })
  return parsed.success ? parsed.data : null
}
