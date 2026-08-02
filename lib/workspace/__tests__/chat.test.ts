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
  return { runWorkspaceChat: mod.runWorkspaceChat }
}

beforeEach(() => {
  fakeCreate.mockReset().mockResolvedValue({ choices: [{ message: { content: 'Fix the critical flag first.' } }] })
})

describe('runWorkspaceChat', () => {
  it('sends flag context and report metadata in the user message', async () => {
    const { runWorkspaceChat } = await loadWorkspaceChat({
      openai: { chat: { completions: { create: fakeCreate } } },
      anthropic: undefined,
    })

    const { reply, mode } = await runWorkspaceChat({
      message: 'What should I fix first?',
      url: 'https://example.com',
      status: 'COMPLETED',
      flags,
    })

    expect(reply).toBe('Fix the critical flag first.')
    expect(mode).toBe('llm')
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
    expect(systemMessage.content).toContain('FixFlags workspace chat')
    expect(systemMessage.content).toContain('rank by severity')
  })

  it('degrades to a canned reply when the model returns empty', async () => {
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

    const { reply } = await runWorkspaceChat({
      message: 'Why does the report fail?',
      url: 'https://example.com',
      status: 'QUEUED',
      flags,
    })
    expect(reply).toContain('Start with the most important Flag')
    expect(reply).toContain('Missing headline above the fold')
  })

  it('degrades to a canned reply when no provider is configured', async () => {
    const { runWorkspaceChat } = await loadWorkspaceChat({
      openai: undefined,
      anthropic: undefined,
    })

    const { reply } = await runWorkspaceChat({
      message: 'Explain this Flag',
      url: 'https://example.com',
      status: 'COMPLETED',
      flags,
    })
    expect(reply).toContain('Start with the most important Flag')
    expect(reply).toContain('Fix: Add an H1 with the primary value proposition')
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
