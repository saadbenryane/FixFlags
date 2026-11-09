import { createHash } from 'node:crypto'
import { estimateLlmCostUsd, captureProviderPricing, providerContextTokenLimit, type ProviderPricing } from '@/lib/billing/provider-pricing'

export type ProviderRequestBound = {
  model: string
  api: 'chat.completions' | 'messages'
  inputTokens: number
  outputTokens: number
  bodySha256: string
  bodyBytes: number
  images: number
  maxCostUsd: number | null
  pricing: ProviderPricing | null
}

export function serializedProviderInputBound(body: Pick<ProviderRequestBound, 'bodyBytes' | 'images'>): number {
  return body.bodyBytes + body.images * 200_000 + 1024
}

/** Conservative configured-price admission, never a provider invoice. Count
 * the complete serialized input, including schemas and image data, rather
 * than estimating only visible prompt text. Unsupported prices stay unknown. */
export function boundProviderRequest(model: string, api: ProviderRequestBound['api'], body: unknown): ProviderRequestBound {
  if (!body || typeof body !== 'object') throw new Error('Provider request requires a bounded body')
  const request = body as Record<string, unknown>
  if (request.model !== undefined && request.model !== model) throw new Error('Provider body model does not match its admission')
  const output = request.max_completion_tokens ?? request.max_tokens
  const count = request.n ?? 1
  if (!Number.isSafeInteger(output) || Number(output) <= 0 || !Number.isSafeInteger(count) || Number(count) <= 0)
    throw new Error('Provider request requires a finite output bound')
  const serialized = JSON.stringify(body)
  let images = 0
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(visit); return }
    const record = value as Record<string, unknown>
    if (record.type === 'image' || record.type === 'image_url') images++
    Object.values(record).forEach(visit)
  }
  visit(body)
  const bodyBytes = Buffer.byteLength(serialized)
  // Base64 bytes are not text tokens. The serialized bound remains conservative,
  // but a valid request cannot consume more than its verified context window.
  const inputTokens = Math.min(serializedProviderInputBound({ bodyBytes, images }), providerContextTokenLimit(model) ?? Infinity)
  const outputTokens = Number(output) * Number(count)
  if (!Number.isSafeInteger(outputTokens)) throw new Error('Provider output bound exceeds the supported integer range')
  const ordinary = estimateLlmCostUsd(model, inputTokens, outputTokens)
  const written = estimateLlmCostUsd(model, 0, outputTokens, 0, inputTokens)
  // A one-hour Anthropic cache creation can cost twice ordinary input.
  const hourWrite = api === 'messages' ? estimateLlmCostUsd(model, inputTokens * 2, outputTokens) : ordinary
  const tierSupported = (request.service_tier === undefined || request.service_tier === 'default' || request.service_tier === 'standard')
    && (request.inference_geo === undefined || request.inference_geo === 'global')
    && (request.speed === undefined || request.speed === 'standard')
  const pricing = captureProviderPricing(model)
  const maxCostUsd = !pricing || !tierSupported || ordinary === null || written === null || hourWrite === null ? null
    : Math.max(ordinary, written, hourWrite)
  return { model, api, inputTokens, outputTokens, bodySha256: createHash('sha256').update(serialized).digest('hex'),
    bodyBytes, images, maxCostUsd, pricing }
}
