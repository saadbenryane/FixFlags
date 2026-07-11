import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('getConfiguredJudgeProviderChain', () => {
  const originalOpenAi = process.env.OPENAI_API_KEY
  const originalAnthropic = process.env.ANTHROPIC_API_KEY
  const originalChain = process.env.JUDGE_PROVIDER_CHAIN

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    if (originalOpenAi === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalOpenAi
    if (originalAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = originalAnthropic
    if (originalChain === undefined) delete process.env.JUDGE_PROVIDER_CHAIN
    else process.env.JUDGE_PROVIDER_CHAIN = originalChain
  })

  it('returns only providers with keys configured', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    delete process.env.ANTHROPIC_API_KEY
    process.env.JUDGE_PROVIDER_CHAIN = 'anthropic,openai'

    const { getConfiguredJudgeProviderChain } = await import('../judge-config')
    expect(getConfiguredJudgeProviderChain()).toEqual(['openai'])
  })

  it('returns empty when no keys are set', async () => {
    delete process.env.OPENAI_API_KEY
    delete process.env.ANTHROPIC_API_KEY

    const { getConfiguredJudgeProviderChain } = await import('../judge-config')
    expect(getConfiguredJudgeProviderChain()).toEqual([])
  })
})
