import { describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { sumPrescriptionResponses } from '../prescription-usage'

const provider = vi.hoisted(() => ({ name: 'openai', create: vi.fn() }))
vi.mock('../judge-runner', () => ({ openai: { chat: { completions: { create: provider.create } } },
  anthropic: { messages: { create: provider.create } },
  runLlmWithRetry: (options: { attemptFn: (name: string, input: unknown) => Promise<unknown>; input: unknown }) => options.attemptFn(provider.name, options.input) }))
vi.mock('../judge-config', () => ({ getProviderConfig: () => ({ model: 'gpt-4o-mini', timeoutMs: 1000, maxTokens: 1000 }) }))
import { runPrescriptionWithRetry, type PrescriptionContext } from '../judge-prescription'

describe('prescription response consumption', () => {
  it('records unknown consumption when an admitted request returns no response', async () => {
    provider.name = 'openai'
    provider.create.mockRejectedValue(new Error('Connection interrupted after request'))
    const onUsage = vi.fn(async () => undefined)
    const context = { url: 'https://example.com/', verdict: 'Recorded', score: 70,
      metadata: { pageText: 'Recorded content', h1s: [], h2s: [], ctaTexts: [] }, techStack: [], existingFlags: [], rubrics: [], onUsage } as unknown as PrescriptionContext
    await expect(runPrescriptionWithRetry(context, null, null)).rejects.toThrow('Connection interrupted')
    expect(onUsage).toHaveBeenCalledExactlyOnceWith(null, 'gpt-4o-mini')
  })

  it.each(['openai', 'anthropic'])('retains %s consumption before rejecting malformed guidance', async name => {
    provider.name = name
    provider.create.mockResolvedValue(name === 'openai'
      ? { model: 'gpt-4o-mini', choices: [{ message: { content: '{}' } }], usage: { prompt_tokens: 20, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 7 } } }
      : { model: 'claude-sonnet-5', content: [{ type: 'tool_use', input: {} }], usage: { input_tokens: 13, output_tokens: 5, cache_read_input_tokens: 7 } })
    const onUsage = vi.fn(async () => undefined)
    const context = { url: 'https://example.com/', verdict: 'Recorded', score: 70,
      metadata: { pageText: 'Recorded content', h1s: [], h2s: [], ctaTexts: [] }, techStack: [], existingFlags: [], rubrics: [], onUsage } as unknown as PrescriptionContext
    await expect(runPrescriptionWithRetry(context, null, null)).rejects.toThrow()
    expect(onUsage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ inputTokens: 13, outputTokens: 5, cacheReadTokens: 7 }), name === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-5')
  })

  it('preserves unmeasured consumption and deduplicates identical response receipts', () => {
    const detail = { version: 1, responseId: randomUUID(), model: 'gpt-4o-mini', usage: { inputTokens: 13, outputTokens: 5, cacheReadTokens: 7, cacheWriteTokens: 0 } }
    expect(sumPrescriptionResponses([{ detail }, { detail }])).toMatchObject({ complete: true, inputTokens: 13, outputTokens: 5, cacheReadTokens: 7 })
    expect(sumPrescriptionResponses([{ detail }, { detail: { ...detail, responseId: randomUUID(), usage: null } }]))
      .toMatchObject({ complete: false, inputTokens: 13, outputTokens: 5 })
    expect(sumPrescriptionResponses([{ detail: {} }]).complete).toBe(false)
  })
})
