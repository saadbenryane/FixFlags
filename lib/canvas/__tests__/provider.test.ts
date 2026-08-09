import { describe, expect, it } from 'vitest'
import { canvasUsageFromProviderResponse } from '@/lib/canvas/provider'

describe('canvasUsageFromProviderResponse', () => {
  it('preserves provider model, input, output, and cache usage', () => {
    expect(canvasUsageFromProviderResponse({
      model: 'provider-model',
      configuredModel: 'configured-model',
      usage: {
        prompt_tokens: 120,
        completion_tokens: 45,
        cache_read_input_tokens: 30,
        cache_creation_input_tokens: 10,
      },
    })).toEqual({
      model: 'provider-model', inputTokens: 120, outputTokens: 45,
      cacheReadTokens: 30, cacheWriteTokens: 10,
    })
  })

  it('reads OpenAI cached tokens and defaults unreported counters to zero', () => {
    expect(canvasUsageFromProviderResponse({
      configuredModel: 'configured-model',
      usage: { prompt_tokens_details: { cached_tokens: 18 } },
    })).toEqual({
      model: 'configured-model', inputTokens: 0, outputTokens: 0,
      cacheReadTokens: 18, cacheWriteTokens: 0,
    })
  })
})
