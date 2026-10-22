import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/audit/llm-keys', () => ({
  hasAnthropicProviderKey: () => true,
  getOpenAIProviderKey: () => 'transport-test-key',
}))
vi.mock('@/lib/audit/judge', () => ({ isRetryableJudgeError: () => true }))

describe('provider transport attempt custody', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules() })

  it.each(['openai', 'anthropic'] as const)('makes one HTTP request per admitted %s attempt', async provider => {
    const transport = vi.fn(async () => new Response(JSON.stringify({
      error: { type: 'rate_limit_error', message: 'Controlled transport refusal' },
    }), { status: 429, headers: { 'content-type': 'application/json' } }))
    vi.stubEnv('ANTHROPIC_API_KEY', 'transport-test-key')
    vi.stubGlobal('fetch', transport)
    const { openai, anthropic } = await import('../judge-runner')
    Object.assign(openai!, { fetch: transport })
    Object.assign(anthropic!, { fetch: transport })

    // A retry here would bypass application admission and response accounting.
    const request = provider === 'openai'
      ? openai!.chat.completions.create({ model: 'transport-test-model', messages: [] })
      : anthropic!.messages.create({ model: 'transport-test-model', messages: [], max_tokens: 1 })
    await expect(request).rejects.toMatchObject({ status: 429 })
    expect(transport).toHaveBeenCalledTimes(1)
  })
})
