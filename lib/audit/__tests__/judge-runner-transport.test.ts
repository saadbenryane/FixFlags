import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'

vi.mock('@/lib/audit/llm-keys', () => ({
  hasAnthropicProviderKey: () => true,
  hasOpenAIProviderKey: () => true,
  getOpenAIProviderKey: () => 'transport-test-key',
}))
vi.mock('@/lib/audit/judge', async () => ({ ...await vi.importActual('@/lib/audit/judge'), isRetryableJudgeError: () => true }))
vi.mock('@/lib/db', () => ({ prisma: { audit: {
  updateMany: vi.fn(async () => ({ count: 1 })), findFirst: vi.fn(async () => ({ id: 'provider-owner' })),
} } }))

describe('provider transport attempt custody', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules() })

  it('interrupts retry backoff when ownership is canceled', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'transport-test-key')
    const { runLlmWithRetry } = await import('../judge-runner')
    const { withExecutionOwnership } = await import('../execution-ownership')
    const attemptFn = vi.fn(async () => { throw new Error('Provider unavailable') })
    const controller = new AbortController()
    const obsolete = withExecutionOwnership({ auditId: 'provider-owner', token: 'attempt', generation: 1, signal: controller.signal }, () =>
      runLlmWithRetry({ label: 'Canceled backoff', input: {}, attemptFn }))
    let finished = false
    const settled = obsolete.then(() => null, error => error).finally(() => { finished = true })
    try {
      await vi.waitFor(() => expect(attemptFn).toHaveBeenCalledOnce())
      controller.abort()
      await vi.waitFor(() => expect(finished).toBe(true), { timeout: 500 })
      expect(await settled).toBeInstanceOf(Error)
      expect(attemptFn).toHaveBeenCalledOnce()
    } finally { controller.abort(); await settled }
  })

  it.each(['openai', 'anthropic'] as const)('cancels native %s SDK transport without another attempt or fallback', async provider => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'transport-test-key')
    const { openai, anthropic, runLlmWithRetry } = await import('../judge-runner')
    const { withExecutionOwnership, ExecutionOwnershipLost } = await import('../execution-ownership')
    let requests = 0, closed = false
    const server = createServer((_request, response) => {
      requests++
      if (requests === 1) { response.on('close', () => { closed = true }); return }
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify(provider === 'openai' ? { id: 'completion', object: 'chat.completion', created: 1, model: 'fixture',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Current observation' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 } }
        : { id: 'message', type: 'message', role: 'assistant', model: 'fixture', content: [{ type: 'text', text: 'Current observation' }],
          stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 2, output_tokens: 2 } }))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    openai!.baseURL = origin
    anthropic!.baseURL = origin
    const request = async () => provider === 'openai'
      ? await openai!.chat.completions.create({ model: 'fixture', messages: [] })
      : await anthropic!.messages.create({ model: 'fixture', messages: [], max_tokens: 1 })
    const attemptFn = vi.fn(request), controller = new AbortController()
    const obsolete = withExecutionOwnership({ auditId: 'provider-owner', token: 'attempt', generation: 1, signal: controller.signal }, () =>
      runLlmWithRetry({ label: 'Canceled explanation', input: {}, attemptFn }))
    const settled = obsolete.then(value => ({ value, error: null }), error => ({ value: null, error }))
    try {
      await vi.waitFor(() => expect(requests).toBe(1))
      controller.abort()
      expect((await settled).error).toBeInstanceOf(ExecutionOwnershipLost)
      await vi.waitFor(() => expect(closed).toBe(true), { timeout: 1000 })
      expect(attemptFn).toHaveBeenCalledOnce()
      await expect(request()).resolves.toMatchObject({ model: 'fixture' })
      expect(requests).toBe(2)
    } finally {
      controller.abort()
      server.closeAllConnections()
      await obsolete.catch(() => undefined)
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })

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

  it.each(['openai', 'anthropic'] as const)('prepares source-bound nonvisual guidance through the installed %s SDK without images', async provider => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'transport-test-key')
    vi.stubEnv('JUDGE_PROVIDER_CHAIN', provider)
    const key = 'security-hsts-missing'
    const payload = { flagPrescriptions: { [key]: {
      fix: 'Set the `Strict-Transport-Security` response header on the recorded HTTPS origin after confirming its routes support HTTPS.',
      agentPrompt: null,
    } } }
    let sent: { messages: Array<{ role: string; content: Array<{ type: string; text?: string }> }> } | undefined
    const transport = vi.fn<typeof fetch>(async (input, init) => {
      sent = await new Request(input, init).json()
      return new Response(JSON.stringify(provider === 'openai'
        ? { id: 'completion-fixture', object: 'chat.completion', created: 1, model: 'gpt-6-luna', service_tier: 'default',
          choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(payload) }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25,
            prompt_tokens_details: { cached_tokens: 7, cache_write_tokens: 3 }, completion_tokens_details: { reasoning_tokens: 2 } } }
        : { id: 'message-fixture', type: 'message', role: 'assistant', model: 'claude-sonnet-5',
          content: [{ type: 'tool_use', id: 'tool-fixture', name: 'quality_prescription', input: payload }],
          stop_reason: 'tool_use', stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 7, cache_creation_input_tokens: 3, service_tier: 'standard' } }),
      { headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', transport)
    const { runPrescriptionWithRetry } = await import('../judge-prescription')
    const consumed = vi.fn(async () => undefined), admitted = vi.fn(async () => consumed)
    const evidence = 'The HTTPS response omits the Strict-Transport-Security header.'
    const result = await runPrescriptionWithRetry({ url: 'https://example.test/', metadata: null, techStack: [], rubrics: [],
      existingFlags: [{ flagKey: key, source: 'DETERMINISTIC', rubric: 'REACH', severity: 'IMPORTANT', attention: 'flag',
        problem: 'Missing Strict-Transport-Security header', checkId: key, evidence,
        verificationRule: 'Fetch the original HTTPS origin and inspect the response header.' }], onAttempt: admitted }, null, null)
    expect(admitted).toHaveBeenCalledOnce()
    expect(transport).toHaveBeenCalledOnce()
    expect(consumed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      provider, api: provider === 'openai' ? 'chat.completions' : 'messages',
      inputTokens: 10, outputTokens: 5, cacheReadTokens: 7, cacheWriteTokens: 3,
      serviceTier: provider === 'openai' ? 'default' : 'standard',
    }))
    expect(result.output.flagPrescriptions[0]).toMatchObject({ evidence, fix: payload.flagPrescriptions[key].fix })
    const content = sent!.messages.find(message => message.role === 'user')!.content
    expect(content.every(part => part.type === 'text')).toBe(true)
    expect(content.map(part => part.text).join('\n')).toContain('Metadata: Not supplied.')
    expect(content.map(part => part.text).join('\n')).toContain(evidence)
  })
})
