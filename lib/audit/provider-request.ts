import { llmUsageSchema, type LlmUsage } from './provider-usage-contract'
export { llmUsageSchema, type LlmUsage } from './provider-usage-contract'
import type { ProviderUsageAdmission } from './provider-usage'
import { boundProviderRequest, type ProviderRequestBound } from './provider-request-bound'

/** Measure the response before parsing its generated content. */
export async function measuredProviderRequest<T>(options: {
  model: string
  api: ProviderRequestBound['api']
  requestBody: unknown
  onAttempt?: ProviderUsageAdmission
  request: () => PromiseLike<T>
  usage: (response: T) => LlmUsage | null
}): Promise<{ response: T; usage: LlmUsage | null }> {
  const record = await options.onAttempt?.(options.model, boundProviderRequest(options.model, options.api, options.requestBody))
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
  cache_creation?: { ephemeral_5m_input_tokens: number; ephemeral_1h_input_tokens: number } | null
  service_tier?: string | null
  inference_geo?: string | null; speed?: string | null
  output_tokens_details?: { thinking_tokens?: number | null } | null
} | null }, model: string): LlmUsage | null {
  if (!response.usage) return null
  const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0, cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0 }
  if (!Object.values(usage).every(value => Number.isSafeInteger(value) && value >= 0)) return null
  const creation = response.usage.cache_creation
  const reasoning = response.usage.output_tokens_details?.thinking_tokens
  if (reasoning != null && (!Number.isSafeInteger(reasoning) || reasoning < 0 || reasoning > usage.outputTokens)) return null
  if (creation && (![creation.ephemeral_5m_input_tokens, creation.ephemeral_1h_input_tokens]
    .every(value => Number.isSafeInteger(value) && value >= 0)
    || creation.ephemeral_5m_input_tokens + creation.ephemeral_1h_input_tokens !== usage.cacheWriteTokens)) return null
  const parsed = llmUsageSchema.safeParse({ ...usage, model: response.model ?? model, provider: 'anthropic', api: 'messages',
    ...(response.usage.inference_geo ? { inferenceGeo: response.usage.inference_geo } : {}),
    ...(response.usage.speed ? { speed: response.usage.speed } : {}),
    ...(reasoning == null ? {} : { reasoningTokens: reasoning }),
    ...(creation ? { cacheWrite5mTokens: creation.ephemeral_5m_input_tokens, cacheWrite1hTokens: creation.ephemeral_1h_input_tokens } : {}),
    serviceTier: response.usage.service_tier ?? 'unknown',
    ...(response.id ? { providerResponseId: response.id } : {}) })
  return parsed.success ? parsed.data : null
}
