import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }))
vi.mock('@/lib/env', () => ({ getEnv: () => fixture.env }))
import { getChatProviderConfig, getPrescriptionProviderConfig, getProviderConfig, getTriageProviderConfig } from '../judge-config'

beforeEach(() => { fixture.env = {} })
describe('independent repair-guidance model configuration', () => {
  it('uses the validated structured-output model without changing scoring, triage or chat', () => {
    expect(getPrescriptionProviderConfig('openai')).toMatchObject({ model: 'gpt-6-luna', reasoningEffort: 'none', maxTokens: 8192, timeoutMs: 90000 })
    for (const config of [getProviderConfig('openai'), getTriageProviderConfig('openai'), getChatProviderConfig('openai')])
      expect(config.model).toBe('gpt-4o-mini')
  })
  it('retains an explicit legacy judge model unless prescription has its own choice', () => {
    fixture.env.OPENAI_JUDGE_MODEL = 'configured-legacy-model'
    expect(getPrescriptionProviderConfig('openai')).toMatchObject({ model: 'configured-legacy-model' })
    expect(getPrescriptionProviderConfig('openai').reasoningEffort).toBeUndefined()
    fixture.env.OPENAI_PRESCRIPTION_MODEL = 'gpt-6-luna'
    expect(getPrescriptionProviderConfig('openai')).toMatchObject({ model: 'gpt-6-luna', reasoningEffort: 'none' })
    expect(getProviderConfig('openai').model).toBe('configured-legacy-model')
  })
  it('keeps the existing token budget and clamps to remaining time', () => {
    fixture.env.OPENAI_JUDGE_MAX_TOKENS = '1500'
    fixture.env.JUDGE_TIMEOUT_MS = '1000'
    expect(getPrescriptionProviderConfig('openai', 200)).toMatchObject({ maxTokens: 1500, timeoutMs: 200 })
  })
  it('keeps provider-specific choices separate', () => {
    fixture.env.OPENAI_PRESCRIPTION_MODEL = 'gpt-6-luna'
    fixture.env.ANTHROPIC_PRESCRIPTION_MODEL = 'configured-anthropic-model'
    expect(getPrescriptionProviderConfig('anthropic')).toMatchObject({ model: 'configured-anthropic-model' })
    expect(getPrescriptionProviderConfig('anthropic').reasoningEffort).toBeUndefined()
  })
})
