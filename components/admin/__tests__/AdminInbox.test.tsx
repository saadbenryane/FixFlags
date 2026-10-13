import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AdminInbox } from '../AdminInbox'
const state = vi.hoisted(() => ({
  params: new URLSearchParams(),
  error: null as Error | null,
  selected: null as unknown,
  mutate: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => state.params,
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('swr', () => ({
  default: (url: string) =>
    url?.includes('?filter=')
      ? {
          data: {
            sessions: [
              { id: 'a', visitorEmail: 'alice@example.com', status: 'WAITING', unreadByAgent: 0 },
            ],
            hasNext: true,
          },
          error: state.error,
          mutate: state.mutate,
          isLoading: false,
        }
      : { data: state.selected, error: null, mutate: state.mutate, isLoading: false },
}))
vi.mock('../SupportComposer', () => ({
  SupportComposer: ({ sessionId }: { sessionId: string }) => (
    <textarea aria-label="Saved recipient" value={sessionId} readOnly />
  ),
}))
vi.mock('../AdminActionButton', () => ({ AdminActionButton: () => null }))
beforeEach(() => {
  state.params = new URLSearchParams()
  state.error = null
  state.selected = null
  state.mutate.mockClear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ messages: [], newest: null }))),
  )
  Element.prototype.scrollIntoView = vi.fn()
})
describe('authoritative support selection', () => {
  it('opens a linked conversation independently of the visible list', () => {
    state.params = new URLSearchParams('session=old')
    state.selected = {
      session: { id: 'old', visitorEmail: 'older@example.com', status: 'CLOSED', project: null },
    }
    render(<AdminInbox />)
    expect(screen.getByRole('heading', { name: 'older@example.com' })).toBeInTheDocument()
    expect(screen.queryByText('Select a conversation')).not.toBeInTheDocument()
  })
  it('keeps the saved draft bound to its selected recipient', () => {
    state.selected = {
      session: { id: 'a', visitorEmail: 'alice@example.com', status: 'WAITING', project: null },
    }
    render(<AdminInbox />)
    fireEvent.click(screen.getByRole('button', { name: /alice@example.com/ }))
    expect(screen.getByLabelText('Saved recipient')).toHaveValue('a')
  })
  it('shows list errors and keeps retry available', () => {
    state.error = new Error('Unavailable')
    render(<AdminInbox />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load conversations')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(state.mutate).toHaveBeenCalled()
  })
  it('provides a next page instead of silently truncating the conversation list', () => {
    render(<AdminInbox />)
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
  })
})
