import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceChatPanel } from '@/components/report/WorkspaceChatPanel'
import type { AgentMessage } from '@/lib/audit/agent-message'

const scanMessages: AgentMessage[] = [
  {
    id: 'scan:a1:preparing',
    sessionId: 'a1',
    auditId: 'a1',
    role: 'agent',
    source: 'scan',
    kind: 'progress',
    state: 'active',
    content: 'I’m preparing your review.',
  },
  {
    id: 'scan:a1:flag:f1',
    sessionId: 'a1',
    auditId: 'a1',
    role: 'agent',
    source: 'scan',
    kind: 'flag',
    state: 'complete',
    content: 'I found a Message Flag: The headline is unclear.',
    flagId: 'f1',
  },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('WorkspaceChatPanel', () => {
  it('names the reviewed page including its path in the Agent header', () => {
    render(
      <WorkspaceChatPanel
        auditId="a1"
        canChat={false}
        productName="Launchpad demo"
        reportUrl="https://fixflags.com/demo"
        agentMessages={scanMessages}
      />,
    )

    expect(screen.getByText('Launchpad demo')).toBeInTheDocument()
    expect(screen.getByText('fixflags.com/demo')).toBeInTheDocument()
    expect(screen.queryByText('fixflags.com')).not.toBeInTheDocument()
  })

  it('shows deterministic Agent messages and a gate-on-send composer without loading private chat', () => {
    render(
      <WorkspaceChatPanel
        auditId="a1"
        canChat={false}
        reportUrl="https://example.com"
        agentMessages={scanMessages}
      />,
    )

    expect(screen.getByLabelText('Agent')).toBeInTheDocument()
    expect(screen.getByText('I’m preparing your review.')).toHaveAttribute('data-source', 'scan')
    expect(screen.getByText(/The headline is unclear/)).toHaveAttribute('data-source', 'scan')
    expect(screen.getByRole('link', { name: 'View Flag' })).toHaveAttribute('href', '?flag=f1#report-flags')
    expect(screen.getByRole('button', { name: 'Sign in to chat' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Sign in to ask about the Flags/i)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uses a title-free toolbar and enters URL mode without creating a scan', () => {
    render(<WorkspaceChatPanel auditId="a1" canChat={false} agentMessages={scanMessages} />)

    expect(screen.getByRole('button', { name: 'Scan history' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'New scan' }))

    expect(screen.getByLabelText('URL to review')).toHaveAttribute('placeholder', 'Paste a URL to review')
    expect(screen.getByRole('button', { name: 'Start review' })).toBeDisabled()
    expect(screen.queryByText('Chat with FixFlags')).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('merges persisted conversation into the same transcript and shows monthly allowance', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [
          { role: 'user', content: 'What should I fix first?' },
          { role: 'assistant', content: 'Start with the headline.' },
        ],
        available: true,
        allowance: { limit: 25_000, used: 5_000, reserved: 0, remaining: 20_000, resetAt: '2026-09-01T00:00:00.000Z' },
      }),
    } as Response)

    render(<WorkspaceChatPanel auditId="a1" canChat agentMessages={scanMessages} />)

    await waitFor(() => expect(screen.getByText('Start with the headline.')).toBeInTheDocument())
    expect(screen.getByText('I’m preparing your review.')).toHaveAttribute('data-source', 'scan')
    expect(screen.getByText('Start with the headline.')).toHaveAttribute('data-source', 'model')
    expect(screen.getByText('80% left')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ask about this report')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
  })
})
