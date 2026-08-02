import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getOpenAIProviderKey, hasAnthropicProviderKey, hasOpenAIProviderKey } from '@/lib/audit/llm-keys'

const ORIGINAL_ENV = { ...process.env }

describe('llm-keys', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    delete process.env.OPENAI_API_KEY
    delete process.env.OPEN_CODE_API_KEY
    delete process.env.OPENCODE_API_KEY
    delete process.env.ANTHROPIC_API_KEY
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('resolves OpenAI-compatible keys from the configured env chain', () => {
    expect(getOpenAIProviderKey()).toBeUndefined()
    process.env.OPEN_CODE_API_KEY = 'open-code-key'
    expect(getOpenAIProviderKey()).toBe('open-code-key')
    process.env.OPENAI_API_KEY = 'openai-key'
    expect(getOpenAIProviderKey()).toBe('openai-key')
  })

  it('reports provider availability from env keys', () => {
    expect(hasOpenAIProviderKey()).toBe(false)
    expect(hasAnthropicProviderKey()).toBe(false)
    process.env.ANTHROPIC_API_KEY = 'anthropic'
    expect(hasAnthropicProviderKey()).toBe(true)
  })
})
