import { llmUsageSchema, type LlmUsage } from '@/lib/audit/provider-usage-contract'
import { z } from 'zod'

const MODEL_IDENTITIES: Record<string, string> = {
  'gpt-4o-mini-2024-07-18': 'gpt-4o-mini',
  'claude-haiku-4-5-20251001': 'claude-haiku-4-5',
}
const modelIdentity = (model: string) => MODEL_IDENTITIES[model] ?? model

const MODEL_RATES: Record<string, { input: number; output: number; contextTokens?: number; cacheReadMultiplier?: number; cacheWriteMultiplier?: number;
  longContext?: { after: number; input: number; output: number } }> = {
  // https://developers.openai.com/api/docs/models/gpt-4o-mini
  'gpt-4o-mini': { input: 0.15, output: 0.6, contextTokens: 128_000 },
  // OpenAI Standard rates verified 2026-10-19: https://developers.openai.com/api/docs/models/gpt-6-luna
  'gpt-6-luna': { input: 0.1, output: 0.5, cacheReadMultiplier: 0.1, cacheWriteMultiplier: 1.25,
    longContext: { after: 272_000, input: 2, output: 1.5 } },
  // Current models (USD per million tokens, sticker rates).
  // Verified 2026-11-05: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
  'claude-sonnet-5': { input: 2, output: 10 },
  // https://platform.claude.com/docs/en/models/haiku-4-5/overview
  'claude-haiku-4-5': { input: 1, output: 5, contextTokens: 200_000 },
  'claude-opus-4-8': { input: 5, output: 25 },
  // Legacy / retired IDs kept so historical audit rows still price correctly.
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
}

export function providerContextTokenLimit(model: string): number | null {
  return MODEL_RATES[modelIdentity(model)]?.contextTokens ?? null
}

function configuredRate(model: string, side: 'input' | 'output', contextTokens: number): number | null {
  const override =
    process.env[side === 'input' ? 'LLM_COST_INPUT_PER_MTOK' : 'LLM_COST_OUTPUT_PER_MTOK']
  const defaults = MODEL_RATES[modelIdentity(model)]
  const multiplier = defaults?.longContext && contextTokens > defaults.longContext.after ? defaults.longContext[side] : 1
  const rate = override === undefined || override === ''
    ? defaults && defaults[side] * multiplier : Number(override)
  return typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 ? rate : null
}

/**
 * Cached-input read multiplier vs. the base input rate.
 * Anthropic serves cache reads at ~0.1x; OpenAI cached input is ~0.5x.
 */
function cacheReadMultiplier(model: string): number {
  const configured = MODEL_RATES[modelIdentity(model)]?.cacheReadMultiplier
  if (configured !== undefined) return configured
  return model.includes('claude') ? 0.1 : 0.5
}

/**
 * Cache-write multiplier vs. the base input rate.
 * Rates follow the model. Current requests use the providers' default lifetime.
 */
function cacheWriteMultiplier(model: string): number {
  const configured = MODEL_RATES[modelIdentity(model)]?.cacheWriteMultiplier
  if (configured !== undefined) return configured
  return model.includes('claude') ? 1.25 : 0
}

function estimateSingleModelCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheWriteTokens = 0,
): number | null {
  if ([inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens].every((value) => value === 0))
    return 0
  const contextTokens = inputTokens + cacheReadTokens + cacheWriteTokens
  const inputRate = configuredRate(model, 'input', contextTokens)
  const outputRate = configuredRate(model, 'output', contextTokens)
  if (inputRate === null || outputRate === null) return null
  const inputCost = (inputTokens / 1_000_000) * inputRate
  const outputCost = (outputTokens / 1_000_000) * outputRate
  const cacheReadCost = (cacheReadTokens / 1_000_000) * inputRate * cacheReadMultiplier(model)
  const cacheWriteCost = (cacheWriteTokens / 1_000_000) * inputRate * cacheWriteMultiplier(model)
  return inputCost + outputCost + cacheReadCost + cacheWriteCost
}

/**
 * Estimate LLM spend for a call (or a comma-joined multi-model run).
 *
 * `inputTokens` is normalized ordinary input, excluding cache reads and writes.
 * OpenAI includes both in its prompt total; Anthropic reports them separately.
 */
export function estimateLlmCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheWriteTokens = 0,
): number | null {
  if (
    [inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens].some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  )
    return null
  // A combined token total cannot establish how much each model consumed.
  if (model.split(',').filter((value) => value.trim()).length > 1) return null
  return estimateSingleModelCostUsd(
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
  )
}


export const providerPricingSchema = z.object({ model: z.string().min(1).max(200),
  inputPerMtok: z.number().finite().nonnegative(), outputPerMtok: z.number().finite().nonnegative(),
  cacheReadMultiplier: z.number().finite().nonnegative(), cacheWriteMultiplier: z.number().finite().nonnegative(),
  longContext: z.object({ after: z.number().int().positive(), inputPerMtok: z.number().finite().nonnegative(),
    outputPerMtok: z.number().finite().nonnegative() }).strict().nullable(),
}).strict()
export type ProviderPricing = z.infer<typeof providerPricingSchema>

/** Gateway rates are a separate explicit contract. Never borrow a direct
 * provider's model prices merely because the endpoint speaks its protocol. */
export function captureChatGatewayPricing(model: string): ProviderPricing | null {
  const rates = ['CHAT_COST_INPUT_PER_MTOK', 'CHAT_COST_OUTPUT_PER_MTOK',
    'CHAT_COST_CACHE_READ_PER_MTOK', 'CHAT_COST_CACHE_WRITE_PER_MTOK'].map(name => {
    const value = process.env[name]
    return value !== undefined && value.trim() !== '' ? Number(value) : NaN
  })
  if (!rates.every(value => Number.isFinite(value) && value >= 0)) return null
  const [inputPerMtok, outputPerMtok, read, write] = rates
  if (inputPerMtok === 0 && (read !== 0 || write !== 0)) return null
  return { model, inputPerMtok, outputPerMtok, cacheReadMultiplier: inputPerMtok ? read / inputPerMtok : 0,
    cacheWriteMultiplier: inputPerMtok ? write / inputPerMtok : 0, longContext: null }
}

/** Freeze configured rates with the request. A later configuration change
 * cannot reprice an admitted response or its recorded estimate. */
export function captureProviderPricing(model: string): ProviderPricing | null {
  // An ordinary input/output override cannot establish the cache or context
  // contract of an unregistered model. Preserve the raw usage as unpriced.
  if (!MODEL_RATES[modelIdentity(model)]) return null
  const inputPerMtok = configuredRate(model, 'input', 0), outputPerMtok = configuredRate(model, 'output', 0)
  if (inputPerMtok === null || outputPerMtok === null) return null
  const long = MODEL_RATES[modelIdentity(model)]?.longContext
  return { model, inputPerMtok, outputPerMtok, cacheReadMultiplier: cacheReadMultiplier(model),
    cacheWriteMultiplier: cacheWriteMultiplier(model), longContext: long ? { after: long.after,
      inputPerMtok: configuredRate(model, 'input', long.after + 1)!, outputPerMtok: configuredRate(model, 'output', long.after + 1)! } : null }
}

/** Preserve measured tokens when processing modifiers cannot be priced. */
export function priceProviderMeasurement(usage: LlmUsage, pricing: ProviderPricing | null): number | null {
  if (!pricing || !providerPricingSchema.safeParse(pricing).success || modelIdentity(usage.model) !== modelIdentity(pricing.model)) return null
  if (!llmUsageSchema.safeParse(usage).success || (usage.reasoningTokens ?? 0) > usage.outputTokens) return null
  if (usage.inferenceGeo !== undefined && usage.inferenceGeo !== 'global' || usage.speed !== undefined && usage.speed !== 'standard') return null
  if (usage.serviceTier !== undefined && usage.serviceTier !== 'default' && usage.serviceTier !== 'standard') return null
  if (usage.provider === 'openai' && (usage.api !== 'chat.completions' || usage.serviceTier === 'standard')) return null
  if (usage.provider === 'anthropic' && (usage.api !== 'messages' || usage.serviceTier === 'default')) return null
  const five = usage.cacheWrite5mTokens, hour = usage.cacheWrite1hTokens
  if (five !== undefined || hour !== undefined) {
    if (usage.provider !== 'anthropic' || five === undefined || hour === undefined || five + hour !== (usage.cacheWriteTokens ?? 0)) return null
  }
  const context = usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
  const rates = pricing.longContext && context > pricing.longContext.after ? pricing.longContext : pricing
  return (usage.inputTokens * rates.inputPerMtok + usage.outputTokens * rates.outputPerMtok
    + (usage.cacheReadTokens ?? 0) * rates.inputPerMtok * pricing.cacheReadMultiplier
    + (five ?? usage.cacheWriteTokens ?? 0) * rates.inputPerMtok * pricing.cacheWriteMultiplier
    + (hour ?? 0) * rates.inputPerMtok * 2) / 1_000_000
}

export function estimateLlmMeasurementCostUsd(usage: LlmUsage): number | null {
  return priceProviderMeasurement(usage, captureProviderPricing(usage.model))
}
