import { describe, it, expect, vi, beforeEach } from 'vitest'

const fakeCreate = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    choices: [{ message: { content: 'Fix the critical flag first.' } }],
  })
)

vi.mock('@/lib/audit/judge-runner', () => ({
  openai: { chat: { completions: { create: fakeCreate } } },
}))

import { runWorkspaceChat, type ChatFlagContext } from '@/lib/workspace/chat'

const flags: ChatFlagContext[] = [
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

beforeEach(() => {
  fakeCreate.mockClear()
})

describe('runWorkspaceChat', () => {
  it('returns a helpful fallback when openai is undefined', async () => {
    vi.resetModules()
    vi.doMock('@/lib/audit/judge-runner', () => ({ openai: undefined }))
    const { runWorkspaceChat: fallbackChat } = await import('@/lib/workspace/chat')
    const reply = await fallbackChat({
      message: 'hello',
      url: 'https://example.com',
      status: 'COMPLETED',
      flags: [],
    })
    expect(reply).toContain('AI chat is not configured')
  })

  it('sends flag context and report metadata in the user message', async () => {
    const reply = await runWorkspaceChat({
      message: 'What should I fix first?',
      url: 'https://example.com',
      status: 'COMPLETED',
      flags,
    })

    expect(reply).toBe('Fix the critical flag first.')
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

  it('falls back to the retry prompt when the model returns empty', async () => {
    fakeCreate.mockResolvedValueOnce({ choices: [{ message: { content: '' } }] })
    const reply = await runWorkspaceChat({
      message: 'Why does the report fail?',
      url: 'https://example.com',
      status: 'QUEUED',
      flags: [],
    })
    expect(reply).toContain('I could not generate a reply')
    expect(reply).toContain('Try asking about a specific Flag')
  })

  it('uses no-flag message when flags array is empty', async () => {
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
