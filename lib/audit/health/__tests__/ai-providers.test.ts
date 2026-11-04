import { afterEach, describe, expect, it, vi } from 'vitest'

const isAiProviderConfigured = vi.hoisted(() => vi.fn())
const getJudgeProviderChain = vi.hoisted(() => vi.fn())
const getConfiguredJudgeProviderChain = vi.hoisted(() => vi.fn())
const getOpenAIProviderKey = vi.hoisted(() => vi.fn())
const openaiCreate = vi.hoisted(() => vi.fn())
const anthropicCreate = vi.hoisted(() => vi.fn())
const openaiOptions = vi.hoisted(() => vi.fn())
const anthropicOptions = vi.hoisted(() => vi.fn())

vi.mock('@/lib/env', () => ({ isAiProviderConfigured }))
vi.mock('@/lib/audit/judge-config', () => ({
  getJudgeProviderChain,
  getConfiguredJudgeProviderChain,
}))
vi.mock('@/lib/audit/llm-keys', () => ({ getOpenAIProviderKey }))
vi.mock('@/lib/audit/pipeline/context', () => ({
  sanitizeAuditErrorMessage: (message: string) => message,
}))
vi.mock('openai', () => ({
  default: class {
    constructor(public options: Record<string, unknown>) { openaiOptions(options) }
    chat = { completions: { create: openaiCreate } }
  },
}))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    constructor(public options: Record<string, unknown>) { anthropicOptions(options) }
    messages = { create: anthropicCreate }
  },
}))

import {
  getAiProviderHealth,
  validateAiProviderCredentials,
} from '@/lib/audit/health/ai-providers'

describe('getAiProviderHealth', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reports configured providers and keys', () => {
    isAiProviderConfigured.mockReturnValue(true)
    getJudgeProviderChain.mockReturnValue(['openai', 'anthropic'])
    getConfiguredJudgeProviderChain.mockReturnValue(['openai'])
    getOpenAIProviderKey.mockReturnValue('sk-test')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')

    const health = getAiProviderHealth()
    expect(health).toEqual({
      configured: true,
      providerChain: ['openai', 'anthropic'],
      configuredProviders: ['openai'],
      openai: true,
      anthropic: true,
    })
  })

  it('reports unconfigured state when nothing is set', () => {
    isAiProviderConfigured.mockReturnValue(false)
    getJudgeProviderChain.mockReturnValue([])
    getConfiguredJudgeProviderChain.mockReturnValue([])
    getOpenAIProviderKey.mockReturnValue('')
    vi.stubEnv('ANTHROPIC_API_KEY', '')

    const health = getAiProviderHealth()
    expect(health.configured).toBe(false)
    expect(health.openai).toBe(false)
    expect(health.anthropic).toBe(false)
  })
})

describe('validateAiProviderCredentials', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('returns null when no provider is configured', async () => {
    getConfiguredJudgeProviderChain.mockReturnValue([])
    await expect(validateAiProviderCredentials()).resolves.toBeNull()
  })

  it('reports a missing OpenAI key without calling the SDK', async () => {
    getConfiguredJudgeProviderChain.mockReturnValue(['openai'])
    getOpenAIProviderKey.mockReturnValue('')
    const result = await validateAiProviderCredentials()
    expect(result).toMatchObject({ ok: false, provider: 'openai' })
    expect(result?.error).toContain('OPENAI_API_KEY')
    expect(openaiCreate).not.toHaveBeenCalled()
  })

  it('validates OpenAI credentials with a minimal probe', async () => {
    getConfiguredJudgeProviderChain.mockReturnValue(['openai'])
    getOpenAIProviderKey.mockReturnValue('sk-test')
    openaiCreate.mockResolvedValueOnce({ id: 'probe' })

    const result = await validateAiProviderCredentials()
    expect(result).toEqual({ ok: true, provider: 'openai' })
    expect(openaiOptions).toHaveBeenCalledWith({ apiKey: 'sk-test', timeout: 15_000, maxRetries: 0 })
    expect(openaiCreate).toHaveBeenCalledWith({
      model: 'gpt-4o-mini',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'ok' }],
    })
  })

  it('validates Anthropic credentials with a minimal probe', async () => {
    getConfiguredJudgeProviderChain.mockReturnValue(['anthropic'])
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')
    anthropicCreate.mockResolvedValueOnce({ id: 'probe' })

    const result = await validateAiProviderCredentials()
    expect(result).toEqual({ ok: true, provider: 'anthropic' })
    expect(anthropicOptions).toHaveBeenCalledWith({ apiKey: 'sk-ant-test', timeout: 15_000, maxRetries: 0 })
    expect(anthropicCreate).toHaveBeenCalledWith({
      model: 'claude-haiku-4-5',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'ok' }],
    })
  })

  it('reports an unknown provider from the chain', async () => {
    getConfiguredJudgeProviderChain.mockReturnValue(['custom'])
    const result = await validateAiProviderCredentials()
    expect(result).toMatchObject({ ok: false, provider: 'custom' })
    expect(result?.error).toContain('Unknown provider')
  })

  it('distinguishes a typed authentication rejection from provider unavailability', async () => {
    getConfiguredJudgeProviderChain.mockReturnValue(['openai'])
    getOpenAIProviderKey.mockReturnValue('sk-test')
    openaiCreate.mockRejectedValueOnce(Object.assign(new Error('401 invalid api key'), { status: 401 }))

    const result = await validateAiProviderCredentials()
    expect(result).toMatchObject({ ok: false, provider: 'openai', failure: 'authentication_rejected' })
    expect(result?.error).toContain('401 invalid api key')
  })

  it.each([[403, 'permission_denied'], [429, 'provider_limit'], [503, 'provider_unavailable'],
    [undefined, 'provider_unavailable']] as const)('retains SDK availability failure %s without inventing invalid credentials', async (status, failure) => {
    getConfiguredJudgeProviderChain.mockReturnValue(['openai'])
    getOpenAIProviderKey.mockReturnValue('sk-test')
    openaiCreate.mockRejectedValueOnce(Object.assign(new Error('Provider request did not complete'), { status }))
    expect(await validateAiProviderCredentials()).toMatchObject({ ok: false, provider: 'openai', failure })
  })

  it('reports a typed credit failure as unavailable quota rather than authentication or temporary pacing', async () => {
    getConfiguredJudgeProviderChain.mockReturnValue(['openai'])
    getOpenAIProviderKey.mockReturnValue('sk-test')
    openaiCreate.mockRejectedValueOnce(Object.assign(new Error('Provider credit unavailable'), { status: 429, code: 'credit_balance_exhausted' }))
    expect(await validateAiProviderCredentials()).toMatchObject({ ok: false, provider: 'openai', failure: 'quota_exhausted' })
  })
})
