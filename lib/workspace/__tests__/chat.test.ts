import { describe, it, expect, vi, beforeEach } from 'vitest'

const fakeCreate = vi.fn()

const flags = [
  {
    id: 'flag-1',
    rubric: 'Message',
    severity: 'CRITICAL',
    problem: 'Missing headline above the fold',
    evidence: 'Hero section has no H1 visible at 1280x800',
    fix: 'Add an H1 with the primary value proposition',
  },
  {
    id: 'flag-2',
    rubric: 'Experience',
    severity: 'HIGH',
    problem: 'CTA button has insufficient contrast',
    evidence: 'Button text in low-contrast grey on white, ratio 2.8:1',
    fix: 'Darken the button text to meet 4.5:1',
  },
]

async function loadWorkspaceChat(overrides?: {
  openai?: unknown
  anthropic?: unknown
}) {
  vi.resetModules()
  vi.doMock('@/lib/audit/judge-runner', () => ({
    openai: overrides?.openai,
    anthropic: overrides?.anthropic,
  }))
  const mod = await import('@/lib/workspace/chat')
  return {
    runWorkspaceChat: mod.runWorkspaceChat,
    workspaceChatTokenUpperBound: mod.workspaceChatTokenUpperBound,
  }
}

beforeEach(() => {
  fakeCreate.mockReset().mockResolvedValue({
    choices: [{ message: { content: 'Fix the critical flag first.' } }],
    usage: { prompt_tokens: 120, completion_tokens: 18 },
  })
})

describe('runWorkspaceChat', () => {
  it('retains provider-reported cost evidence when the reply is empty', async () => {
    fakeCreate.mockResolvedValue({ model: 'gpt-4o-mini', choices: [{ message: { content: '' } }], usage: { prompt_tokens: 123, completion_tokens: 45 } })
    const { runWorkspaceChat } = await loadWorkspaceChat({ openai: { chat: { completions: { create: fakeCreate } } } })
    await expect(runWorkspaceChat({ message: 'Explain', url: 'https://example.com', status: 'COMPLETED', flags })).rejects.toMatchObject({ usage: { inputTokens: 123, outputTokens: 45, model: 'gpt-4o-mini' } })
  })

  it('sends flag context and report metadata in the user message', async () => {
    const { runWorkspaceChat } = await loadWorkspaceChat({
      openai: { chat: { completions: { create: fakeCreate } } },
      anthropic: undefined,
    })

    const { reply, mode, usage } = await runWorkspaceChat({
      message: 'What should I fix first?',
      url: 'https://example.com',
      status: 'COMPLETED',
      flags,
    })

    expect(reply).toBe('Fix the critical flag first.')
    expect(mode).toBe('llm')
    expect(usage).toEqual({ inputTokens: 120, outputTokens: 18, model: expect.any(String) })
    expect(fakeCreate).toHaveBeenCalledOnce()

    const call = fakeCreate.mock.calls[0]![0]
    expect(call.model).toBeTruthy()
    expect(call.max_tokens).toBeLessThanOrEqual(600)

    const userMessage = call.messages.find((m: { role: string }) => m.role === 'user')
    expect(userMessage.content).toContain('https://example.com')
    expect(userMessage.content).toContain('COMPLETED')
    expect(userMessage.content).toContain('[Message] Missing headline above the fold')
    expect(userMessage.content).toContain('Severity: CRITICAL')
    expect(userMessage.content).toContain('[Experience] CTA button has insufficient contrast')
    expect(userMessage.content).toContain('Fix: Add an H1 with the primary value proposition')
    expect(userMessage.content).toContain('What should I fix first?')

    const systemMessage = call.messages.find((m: { role: string }) => m.role === 'system')
    expect(systemMessage.content).toContain('FixFlags Product Agent')
    expect(systemMessage.content).toContain('cannot certify')
  })

  it('computes a conservative UTF-8 token reservation bound', async () => {
    const { workspaceChatTokenUpperBound } = await loadWorkspaceChat()
    const ascii = workspaceChatTokenUpperBound({
      message: 'hello', url: 'https://example.com', status: 'COMPLETED', flags,
    })
    const unicode = workspaceChatTokenUpperBound({
      message: '👋'.repeat(100), url: 'https://example.com', status: 'COMPLETED', flags,
    })
    expect(ascii).toBeGreaterThan(600)
    expect(unicode).toBeGreaterThan(ascii)
  })

  it('supplies canonical verification state and bounded source scope without treating completion as health', async () => {
    const { runWorkspaceChat, workspaceChatTokenUpperBound } = await loadWorkspaceChat({
      openai: { chat: { completions: { create: fakeCreate } } },
    })
    const input = { message: 'Explain this evidence', url: 'https://example.com', status: 'COMPLETED',
      findingScope: { kind: 'site' as const, currentCount: 14, recentRecoveryCount: 1 },
      uptime: { status: { enabled: true, state: 'unknown' as const, incidentOpen: true, targetUrl: 'https://example.com/',
        lastCheckedAt: '2026-11-03T08:00:00Z', nextCheckAt: null },
        assessment: { state: 'FLAG' as const, observedState: 'unknown' as const, validUntil: null } },
      flags: [{ ...flags[0], status: 'OPEN', verificationState: 'verifying' as const,
        pageUrl: 'https://example.com/pricing', latestOccurrenceAt: '2026-11-03T09:00:00Z' }] }
    await runWorkspaceChat(input)
    const call = fakeCreate.mock.calls[0]![0]
    const prompt = call.messages.find((message: { role: string }) => message.role === 'user').content
    expect(prompt).toContain('Known current Flags: 14')
    expect(prompt).toContain('1 records are supplied below')
    expect(prompt).toContain('do not establish website health')
    expect(prompt).toContain('"assessment":{"state":"FLAG","observedState":"unknown","validUntil":null}')
    expect(prompt).toContain('An unresolved incident remains attention')
    expect(prompt).toContain('State: OPEN\n   Verification: verifying')
    expect(prompt).toContain('Page: https://example.com/pricing')
    expect(prompt).toContain('Recorded at: 2026-11-03T09:00:00Z')
    const sentBytes = Buffer.byteLength(call.messages.map((message: { content: string }) => message.content).join('\n'))
    expect(workspaceChatTokenUpperBound(input)).toBeGreaterThanOrEqual(sentBytes + call.max_tokens)
  })

  it('reports unavailable when the model returns empty', async () => {
    const { runWorkspaceChat } = await loadWorkspaceChat({
      openai: {
        chat: {
          completions: {
            create: fakeCreate.mockResolvedValueOnce({ choices: [{ message: { content: '' } }] }),
          },
        },
      },
      anthropic: undefined,
    })

    await expect(runWorkspaceChat({
      message: 'Why does the report fail?',
      url: 'https://example.com',
      status: 'QUEUED',
      flags,
    })).rejects.toThrow('Workspace chat is unavailable')
  })

  it('reports unavailable when no provider is configured', async () => {
    const { runWorkspaceChat } = await loadWorkspaceChat({
      openai: undefined,
      anthropic: undefined,
    })

    await expect(runWorkspaceChat({
      message: 'Explain this Flag',
      url: 'https://example.com',
      status: 'COMPLETED',
      flags,
    })).rejects.toThrow('Workspace chat is unavailable')
  })

  it('uses no-flag message when flags array is empty', async () => {
    const { runWorkspaceChat } = await loadWorkspaceChat({
      openai: {
        chat: {
          completions: {
            create: fakeCreate,
          },
        },
      },
      anthropic: undefined,
    })

    await runWorkspaceChat({
      message: 'hello',
      url: 'https://example.com',
      status: 'QUEUED',
      flags: [],
    })
    const call = fakeCreate.mock.calls[0]![0]
    const userMessage = call.messages.find((m: { role: string }) => m.role === 'user')
    expect(userMessage.content).toContain('No Flags on this report yet.')
  })
})
