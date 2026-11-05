import type { LlmUsage } from './judge-runner'
import type { ProviderUsageAdmission } from './provider-usage'

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

export function openAIResponseUsage(response: { model?: string; usage?: {
  prompt_tokens: number; completion_tokens: number; prompt_tokens_details?: { cached_tokens?: number } | null
} | null }, model: string): LlmUsage | null {
  if (!response.usage) return null
  const { prompt_tokens: input, completion_tokens: output } = response.usage
  const cached = response.usage.prompt_tokens_details?.cached_tokens ?? 0
  if (![input, output, cached].every(value => Number.isInteger(value) && value >= 0) || cached > input) return null
  return { inputTokens: input - cached, outputTokens: output, cacheReadTokens: cached, model: response.model ?? model }
}

export function anthropicResponseUsage(response: { model?: string; usage: {
  input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null
} }, model: string): LlmUsage | null {
  const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0, cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0 }
  if (!Object.values(usage).every(value => Number.isInteger(value) && value >= 0)) return null
  return { ...usage, model: response.model ?? model }
}
