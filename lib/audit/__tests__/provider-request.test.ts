import { describe, expect, it } from 'vitest'
import { anthropicResponseUsage, openAIResponseUsage } from '../provider-request'
import { sumProviderResponses } from '../provider-usage'

describe('normalized provider consumption', () => {
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
