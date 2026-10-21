import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderUsageAdmission } from '../../provider-usage'

const provider = vi.hoisted(() => ({ name: 'openai', create: vi.fn() }))
vi.mock('../../judge-runner', () => ({
  openai: { chat: { completions: { create: provider.create } } },
  anthropic: { messages: { create: provider.create } },
  isProviderConfigured: () => true,
  runLlmWithRetry: (options: { attemptFn: (name: string, input: unknown) => Promise<unknown>; input: unknown }) => options.attemptFn(provider.name, options.input),
}))
vi.mock('../../judge-config', () => ({ getTriageProviderConfig: () => ({ model: 'requested-model', timeoutMs: 1000, maxTokens: 1000 }) }))
import { planJourney } from '../planner'
import { evaluateJourney } from '../evaluator'

const calls = [
  { name: 'planner', run: (admit: ProviderUsageAdmission) => planJourney({ url: 'https://example.com/', contract: null,
    initialTree: 'Recorded page', metadata: { title: 'Recorded', description: '', h1s: [] }, links: [] }, 1000, admit) },
  { name: 'evaluator', run: (admit: ProviderUsageAdmission) => evaluateJourney({ url: 'https://example.com/',
    journeyType: 'multi-step-funnel', goalAchieved: false, steps: [], summary: 'Recorded walk', purpose: null }, 1000, admit) },
]

describe.each(calls)('$name provider consumption custody', ({ run }) => {
  beforeEach(() => { provider.name = 'openai'; provider.create.mockReset() })

  it('refuses the external request when durable admission fails', async () => {
    await expect(run(async () => { throw Error('Admission refused') })).rejects.toThrow('Admission refused')
    expect(provider.create).not.toHaveBeenCalled()
  })

  it.each(['openai', 'anthropic'])('records %s consumption before generated content is parsed', async name => {
    provider.name = name
    const consumed = vi.fn(async () => undefined)
    provider.create.mockResolvedValue(name === 'openai'
      ? { model: 'actual-openai-model', choices: [{ message: { tool_calls: [{ type: 'function', function: { arguments: '{invalid' } }] } }],
        usage: { prompt_tokens: 20, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 7 } } }
      : { model: 'actual-anthropic-model', content: [{ type: 'tool_use', input: {} }],
        usage: { input_tokens: 13, output_tokens: 5, cache_read_input_tokens: 7, cache_creation_input_tokens: 2 } })
    await expect(run(async () => consumed)).rejects.toThrow()
    expect(consumed).toHaveBeenCalledExactlyOnceWith({ inputTokens: 13, outputTokens: 5, cacheReadTokens: 7,
      ...(name === 'anthropic' ? { cacheWriteTokens: 2 } : {}), model: `actual-${name}-model` })
  })

  it('records unknown consumption when the response is lost', async () => {
    provider.create.mockRejectedValue(Error('Connection interrupted'))
    const consumed = vi.fn(async () => undefined)
    await expect(run(async () => consumed)).rejects.toThrow('Connection interrupted')
    expect(consumed).toHaveBeenCalledExactlyOnceWith(null)
  })

  it.each([undefined, { prompt_tokens: 10, completion_tokens: 2, prompt_tokens_details: { cached_tokens: 11 } }])(
    'keeps missing or contradictory consumption unknown', async usage => {
      provider.create.mockResolvedValue({ choices: [], usage })
      const consumed = vi.fn(async () => undefined)
      await expect(run(async () => consumed)).rejects.toThrow('No function call')
      expect(consumed).toHaveBeenCalledExactlyOnceWith(null)
    })

  it('cannot publish parsed content after response ownership is lost', async () => {
    provider.create.mockResolvedValue({ choices: [], usage: { prompt_tokens: 10, completion_tokens: 2 } })
    await expect(run(async () => async () => { throw Error('Ownership expired') })).rejects.toThrow('Ownership expired')
  })
})
