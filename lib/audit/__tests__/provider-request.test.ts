import { describe, expect, it } from 'vitest'
import { anthropicResponseUsage, openAIResponseUsage, measuredProviderRequest } from '../provider-request'
import { boundProviderRequest } from '../provider-request-bound'
import { captureProviderPricing, priceProviderMeasurement } from '@/lib/billing/provider-pricing'
import { vi } from 'vitest'
import { sumProviderResponses } from '../provider-usage'

describe('normalized provider consumption', () => {
  it('measures the complete outgoing body before dispatch, including schemas, images and output bounds', async () => {
    const body = { model: 'gpt-4o-mini', max_tokens: 100, messages: [{ role: 'user', content: [
      { type: 'text', text: 'A 🧭 request' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,fixture' } },
    ] }], response_format: { type: 'json_schema', json_schema: { name: 'result', schema: { type: 'object' } } } }
    const order: string[] = []
    const record = vi.fn(async () => { order.push('measured') })
    let admitted: ReturnType<typeof boundProviderRequest> | undefined
    await measuredProviderRequest({ model: body.model, api: 'chat.completions', requestBody: body,
      onAttempt: async (_model, bound) => { admitted = bound; order.push('admitted'); return record },
      request: async () => { order.push('dispatched'); return { usage: { prompt_tokens: 10, completion_tokens: 3 }, service_tier: 'default' } },
      usage: response => openAIResponseUsage(response, body.model) })
    expect(admitted).toMatchObject({ images: 1, bodyBytes: Buffer.byteLength(JSON.stringify(body)), outputTokens: 100 })
    expect(admitted!.inputTokens).toBeGreaterThan(admitted!.bodyBytes)
    expect(admitted!.maxCostUsd).toBeGreaterThan(0)
    expect(order).toEqual(['admitted', 'dispatched', 'measured'])
    const changed = boundProviderRequest(body.model, 'chat.completions', { ...body, response_format: {} })
    expect(changed.bodySha256).not.toBe(admitted!.bodySha256)
  })
  it('does not dispatch after a rejected admission', async () => {
    const request = vi.fn()
    await expect(measuredProviderRequest({ model: 'gpt-4o-mini', api: 'chat.completions', requestBody: { max_tokens: 100 },
      onAttempt: async () => { throw new Error('Dollar admission denied') }, request, usage: () => null }))
      .rejects.toThrow('Dollar admission denied')
    expect(request).not.toHaveBeenCalled()
  })
  it('does not invent cache/context pricing for a new model from two ordinary token overrides', () => {
    try {
      vi.stubEnv('LLM_COST_INPUT_PER_MTOK', '1'); vi.stubEnv('LLM_COST_OUTPUT_PER_MTOK', '2')
      expect(boundProviderRequest('unregistered-model', 'chat.completions', { max_tokens: 100 }).maxCostUsd).toBeNull()
    } finally { vi.unstubAllEnvs() }
  })
  it('bounds image admission by the verified model window rather than charging base64 bytes as tokens', () => {
    const bound = boundProviderRequest('gpt-4o-mini-2024-07-18', 'chat.completions', { max_tokens: 100,
      messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,' + 'A'.repeat(2_000_000) } }] }] })
    expect(bound.bodyBytes).toBeGreaterThan(2_000_000)
    expect(bound.inputTokens).toBe(128_000)
    expect(bound.maxCostUsd).toBeCloseTo(0.01926, 10)
  })
  it('retains and prices mixed Anthropic cache lifetimes without adding creation tokens twice', () => {
    const usage = anthropicResponseUsage({ usage: { input_tokens: 100, output_tokens: 20, service_tier: 'standard',
      cache_read_input_tokens: 400, cache_creation_input_tokens: 248,
      cache_creation: { ephemeral_5m_input_tokens: 148, ephemeral_1h_input_tokens: 100 } } }, 'claude-haiku-4-5')!
    expect(usage).toMatchObject({ cacheWriteTokens: 248, cacheWrite5mTokens: 148, cacheWrite1hTokens: 100 })
    expect(priceProviderMeasurement(usage, captureProviderPricing(usage.model))).toBeCloseTo(0.000625, 10)
    expect(anthropicResponseUsage({ usage: { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: 247,
      cache_creation: { ephemeral_5m_input_tokens: 148, ephemeral_1h_input_tokens: 100 } } }, usage.model)).toBeNull()
  })
  it('preserves the admitted configured price across later rate changes and known snapshot IDs', () => {
    const pricing = captureProviderPricing('gpt-4o-mini')
    try {
      vi.stubEnv('LLM_COST_INPUT_PER_MTOK', '99')
      const usage = { model: 'gpt-4o-mini-2024-07-18', inputTokens: 1_000_000, outputTokens: 0 }
      expect(priceProviderMeasurement(usage, pricing)).toBeCloseTo(0.15, 10)
      expect(priceProviderMeasurement({ ...usage, model: 'unrelated-model' }, pricing)).toBeNull()
    } finally { vi.unstubAllEnvs() }
  })
  it('retains Anthropic processing modifiers and inclusive reasoning without borrowing standard global prices', () => {
    const usage = anthropicResponseUsage({ usage: { input_tokens: 10, output_tokens: 20, service_tier: 'standard',
      speed: 'fast', inference_geo: 'us', output_tokens_details: { thinking_tokens: 12 } } }, 'claude-haiku-4-5')!
    expect(usage).toMatchObject({ outputTokens: 20, reasoningTokens: 12, speed: 'fast', inferenceGeo: 'us' })
    expect(priceProviderMeasurement(usage, captureProviderPricing(usage.model))).toBeNull()
    expect(boundProviderRequest(usage.model, 'messages', { max_tokens: 100, speed: 'fast' }).maxCostUsd).toBeNull()
  })
  it('partitions OpenAI input once and retains billed reasoning inside output', () => {
    expect(openAIResponseUsage({ id: 'response-1', model: 'gpt-6-luna', service_tier: 'default', usage: {
      prompt_tokens: 12_000, completion_tokens: 1_000,
      prompt_tokens_details: { cached_tokens: 4_000, cache_write_tokens: 7_000 },
      completion_tokens_details: { reasoning_tokens: 300 },
    } }, 'requested-model')).toEqual({ model: 'gpt-6-luna', provider: 'openai', api: 'chat.completions',
      serviceTier: 'default', providerResponseId: 'response-1', inputTokens: 1_000, cacheReadTokens: 4_000,
      cacheWriteTokens: 7_000, outputTokens: 1_000, reasoningTokens: 300 })
  })

  it('retains Anthropic separate input categories without subtracting cache counts', () => {
    expect(anthropicResponseUsage({ model: 'claude-sonnet-5', usage: { input_tokens: 100, output_tokens: 20,
      cache_read_input_tokens: 400, cache_creation_input_tokens: 500, service_tier: 'standard' } }, 'requested-model'))
      .toEqual({ model: 'claude-sonnet-5', provider: 'anthropic', api: 'messages',
        inputTokens: 100, outputTokens: 20, cacheReadTokens: 400, cacheWriteTokens: 500, serviceTier: 'standard' })
  })

  it('does not infer an Anthropic processing tier when the usage report omits it', () => {
    expect(anthropicResponseUsage({ usage: { input_tokens: 10, output_tokens: 2 } }, 'claude-haiku-4-5'))
      .toMatchObject({ inputTokens: 10, outputTokens: 2, serviceTier: 'unknown' })
  })

  it.each([
    { prompt_tokens: 10, completion_tokens: 2, prompt_tokens_details: { cached_tokens: 8, cache_write_tokens: 3 } },
    { prompt_tokens: 10, completion_tokens: 2, prompt_tokens_details: { cache_write_tokens: -1 } },
    { prompt_tokens: 10, completion_tokens: 2, completion_tokens_details: { reasoning_tokens: 3 } },
    { prompt_tokens: Number.MAX_SAFE_INTEGER + 1, completion_tokens: 2 },
  ])('keeps contradictory or invalid OpenAI measurements unknown: %j', usage => {
    expect(openAIResponseUsage({ usage }, 'gpt-6-luna')).toBeNull()
  })

  it('does not infer a Standard processing tier when the response omits it', () => {
    expect(openAIResponseUsage({ usage: { prompt_tokens: 10, completion_tokens: 2 } }, 'gpt-6-luna'))
      .toMatchObject({ inputTokens: 10, outputTokens: 2, serviceTier: 'unknown' })
  })

  it('keeps provenance in version-two receipts and deduplicates them alongside historical receipts', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const measured = openAIResponseUsage({ id: 'provider-response', service_tier: 'priority', usage: {
      prompt_tokens: 20, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 7, cache_write_tokens: 3 },
    } }, 'gpt-6-luna')!
    const { model, ...usage } = measured
    const attempt = { event: 'triage_provider_attempt', detail: { version: 2, responseId: id, model, usage: null } }
    const response = { event: 'triage_provider_response', detail: { ...attempt.detail, usage } }
    const historical = { version: 1, responseId: '22222222-2222-4222-8222-222222222222', model: 'gpt-4o-mini' }
    const sum = sumProviderResponses([attempt, response, response,
      { event: 'triage_provider_attempt', detail: { ...historical, usage: null } },
      { event: 'triage_provider_response', detail: { ...historical,
        usage: { inputTokens: 2, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 } } }], 'triage')
    expect(sum).toMatchObject({ complete: true, inputTokens: 12, outputTokens: 6, cacheReadTokens: 7, cacheWriteTokens: 3 })
    expect(sum.measurements[0]).toEqual(measured)
  })
})
