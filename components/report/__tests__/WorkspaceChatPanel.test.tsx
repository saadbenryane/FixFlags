import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceChatPanel } from '@/components/report/WorkspaceChatPanel'
import type { AgentMessage } from '@/lib/audit/agent-message'
import type { ReportWorkspaceCapabilities } from '@/lib/report/workspace-model'

const startScanWithHandoff = vi.hoisted(() => vi.fn())

vi.mock('@/lib/audit/start-scan-handoff', () => ({
  startScanWithHandoff,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/report/a1',
  useSearchParams: () => ({ get: () => null }),
}))
vi.mock('@/components/auth/AuthFlow', () => ({
  AuthFlow: ({ dialogTitle }: { dialogTitle?: string }) => <div>{dialogTitle}</div>,
}))

function capabilities(canChat: boolean): ReportWorkspaceCapabilities {
  return {
    promptAccess: 'none',
    canCopyPrompts: false,
    canReplayTimeline: false,
    canChat,
    canUseCanvas: false,
    canShare: false,
    canExport: false,
    canRecheck: false,
    canGiveFeedback: false,
    demonstratedFlagId: null,
  }
}

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
        capabilities={capabilities(false)}
        gateReason="owner"
        productName="DemoSite"
        reportUrl="https://fixflags.com/demo"
        agentMessages={scanMessages}
      />,
    )

    expect(screen.getByText('DemoSite')).toBeInTheDocument()
    expect(screen.getByText('fixflags.com/demo')).toBeInTheDocument()
    expect(screen.queryByText('fixflags.com')).not.toBeInTheDocument()
  })

  it('shows deterministic Agent messages and a gate-on-send composer without loading private chat', () => {
    render(
      <WorkspaceChatPanel
        auditId="a1"
        capabilities={capabilities(false)}
        gateReason="sign-in"
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
    render(
      <WorkspaceChatPanel
        auditId="a1"
        capabilities={capabilities(false)}
        gateReason="sign-in"
        agentMessages={scanMessages}
      />,
    )

    expect(screen.getByRole('button', { name: 'Review history' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'New review' }))

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

    render(
      <WorkspaceChatPanel
        auditId="a1"
        capabilities={capabilities(true)}
        gateReason="owner"
        agentMessages={scanMessages}
      />,
    )

    await waitFor(() => expect(screen.getByText('Start with the headline.')).toBeInTheDocument())
    expect(screen.getByText('I’m preparing your review.')).toHaveAttribute('data-source', 'scan')
    expect(screen.getByText('Start with the headline.')).toHaveAttribute('data-source', 'model')
    expect(screen.getByText('80% left')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ask about this report')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
  })

  it('keeps non-owner chat read-only without pretending sign-in grants access', () => {
    render(
      <WorkspaceChatPanel
        auditId="a1"
        capabilities={capabilities(false)}
        gateReason="owner"
        reportUrl="https://example.com"
        agentMessages={scanMessages}
      />,
    )

    expect(screen.getByPlaceholderText('You can only chat on your own reports')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Sign in to chat' })).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('opens create-account from History, chat send, and a second anonymous review', async () => {
    startScanWithHandoff.mockResolvedValue({
      ok: false,
      code: 'AUTH_REQUIRED',
      message: 'Create a free account to continue.',
    })
    render(
      <WorkspaceChatPanel
        auditId="a1"
        capabilities={capabilities(false)}
        gateReason="sign-in"
        reportUrl="https://example.com"
        agentMessages={scanMessages}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Review history' }))
    expect(screen.getAllByText('Create your free account').length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Get every fix prompt and keep this report/i).length
    ).toBeGreaterThan(0)
    expect(screen.queryByText(/already used your anonymous product review/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/upgrade/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    fireEvent.change(screen.getByPlaceholderText(/Sign in to ask about the Flags/i), {
      target: { value: 'What first?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to chat' }))
    expect(screen.getAllByText('Create your free account').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    fireEvent.click(screen.getByRole('button', { name: 'New review' }))
    fireEvent.change(screen.getByLabelText('URL to review'), {
      target: { value: 'https://other.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start review' }))
    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalled())
    expect(screen.getAllByText('Create a free account to continue').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('URL to review')).toHaveValue('https://other.com')
  })
})
