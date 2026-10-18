import { describe, expect, it, vi } from 'vitest'

const provider = vi.hoisted(() => ({ name: 'openai', create: vi.fn() }))
vi.mock('../judge-runner', () => ({
  openai: { chat: { completions: { create: provider.create } } },
  anthropic: { messages: { create: provider.create } },
  isProviderConfigured: () => true,
  runLlmWithRetry: (options: { attemptFn: (name: string, input: unknown) => Promise<unknown>; input: unknown }) => options.attemptFn(provider.name, options.input),
}))
vi.mock('../judge-config', () => ({ getTriageProviderConfig: () => ({ model: 'gpt-4o-mini', timeoutMs: 1000, maxTokens: 1000 }) }))
import { runTriageWithRetry } from '../judge-triage'
import type { PageMetadata } from '../metadata'
import type { LlmUsage } from '../judge-runner'
import { sumProviderResponses } from '../provider-usage'

const metadata = { title: 'Recorded website', description: null, pageText: 'Recorded website content', h1s: [], h2s: [], ctaTexts: [], links: [] } as unknown as PageMetadata
type Admission = (model: string) => Promise<(usage: LlmUsage | null) => Promise<void>>
const run = (onAttempt: Admission) => runTriageWithRetry(
  'https://example.com/', metadata, null, null, [], null, null, undefined, undefined, onAttempt)

describe('triage provider consumption custody', () => {
  it('cannot relabel a prescription response as triage consumption', () => {
    const detail = { version: 1, responseId: '11111111-1111-4111-8111-111111111111', model: 'gpt-4o-mini',
      usage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 } }
    expect(sumProviderResponses([{ event: 'prescription_provider_attempt', detail: { ...detail, usage: null } },
      { event: 'prescription_provider_response', detail }], 'triage')).toMatchObject({ complete: false, inputTokens: 0, outputTokens: 0 })
  })
  it('does not call the provider without durable attempt admission', async () => {
    provider.name = 'openai'
    provider.create.mockReset()
    await expect(run(async () => { throw Error('Attempt admission unavailable') })).rejects.toThrow('Attempt admission unavailable')
    expect(provider.create).not.toHaveBeenCalled()
  })

  it.each(['openai', 'anthropic'])('retains %s usage before rejecting invalid output', async name => {
    provider.name = name
    provider.create.mockResolvedValue(name === 'openai'
      ? { model: 'gpt-4o-mini', choices: [{ message: { content: '{}' } }], usage: { prompt_tokens: 20, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 7 } } }
      : { model: 'claude-sonnet-5', content: [{ type: 'tool_use', input: {} }], usage: { input_tokens: 13, output_tokens: 5, cache_read_input_tokens: 7 } })
    const consumed = vi.fn(async () => undefined)
    await expect(run(async () => consumed)).rejects.toThrow()
    expect(consumed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ inputTokens: 13, outputTokens: 5, cacheReadTokens: 7 }))
  })

  it('records unknown consumption when an admitted request returns no response', async () => {
    provider.name = 'openai'
    provider.create.mockRejectedValue(Error('Connection interrupted after request'))
    const consumed = vi.fn(async () => undefined)
    await expect(run(async () => consumed)).rejects.toThrow('Connection interrupted')
    expect(consumed).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('keeps absent response usage unknown before rejecting invalid output', async () => {
    provider.name = 'openai'
    provider.create.mockResolvedValue({ choices: [{ message: { content: '{}' } }] })
    const consumed = vi.fn(async () => undefined)
    await expect(run(async () => consumed)).rejects.toThrow()
    expect(consumed).toHaveBeenCalledExactlyOnceWith(null)
  })
})
