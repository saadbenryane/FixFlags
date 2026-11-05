import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupportProvider, useSupportContext } from '../SupportProvider'
import { SupportWidget } from '../SupportWidget'
import { ConversationWidget } from '../ConversationWidget'
import { SITE_AGENT_COPY as C } from '@/lib/marketing/copy/site-agent'

vi.mock('@/components/live-support/useSupportPolling', () => ({
  useSupportSession: () => ({ data: { session: null }, mutate: vi.fn() }),
  useSupportMessages: () => ({ data: { messages: [] }, mutate: vi.fn() }),
}))

beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

describe('public support through the shared conversation window', () => {
  it('preserves a Help prefill entered after closing a chat whose first message is still sending', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(async (_url: RequestInfo | URL, options?: RequestInit) => options?.method === 'POST'
      ? new Promise<Response>(resolve => { finish = resolve }) : Response.json({})))
    function HelpPrefill() {
      const support = useSupportContext()
      return <button onClick={() => support.openSupportChat({ prefill: 'Keep this question from Help.' })}>Ask from Help</button>
    }
    render(<SupportProvider><HelpPrefill /><SupportWidget /></SupportProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Open live chat' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Support message' }), { target: { value: 'My first question.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ask from Help' }))
    const input = await screen.findByRole('textbox', { name: 'Support message' })
    expect(input).toHaveValue('Keep this question from Help.')
    expect(input).toBeDisabled()
    await act(async () => { finish(Response.json({ session: { id: 'session' } })) })
    await waitFor(() => expect(input).toBeEnabled())
    expect(input).toHaveValue('Keep this question from Help.')
    expect(sessionStorage.getItem('fixflags:support:draft')).toBe('Keep this question from Help.')
  })

  it('keeps a new conversation context draft in storage when an earlier send finishes', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(async (_url: RequestInfo | URL, options?: RequestInit) => options?.method === 'POST'
      ? new Promise<Response>(resolve => { finish = resolve }) : Response.json({})))
    const conversation = (flagId: string) => <SupportProvider><ConversationWidget key={flagId} siteId="site" host="example.com" ownsSite={false} ownerId={null} flagId={flagId} /></SupportProvider>
    const rendered = render(conversation('first'))
    fireEvent.click(screen.getByRole('button', { name: C.openChat }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Support message' }), { target: { value: 'The first question.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    rendered.rerender(conversation('second'))
    const input = await screen.findByRole('textbox', { name: 'Support message' })
    fireEvent.change(input, { target: { value: 'The next context question.' } })
    await act(async () => { finish(Response.json({ session: { id: 'session' } })) })
    expect(input).toHaveValue('The next context question.')
    expect(sessionStorage.getItem('fixflags:support:draft')).toBe('The next context question.')
  })

  it('focuses the composer, closes with Escape and returns focus without creating a session', async () => {
    render(<SupportProvider><SupportWidget /></SupportProvider>)
    const launcher = screen.getByRole('button', { name: 'Open live chat' })
    launcher.focus()
    fireEvent.click(launcher)
    const message = await screen.findByRole('textbox', { name: 'Support message' })
    await waitFor(() => expect(message).toHaveFocus())
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Chat with FixFlags')
    expect(screen.queryByRole('tab', { name: 'Site questions' })).not.toBeInTheDocument()
    fireEvent.keyDown(message, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(launcher).toHaveFocus())
    expect(fetch).not.toHaveBeenCalled()
    expect(Object.keys(sessionStorage).some(key => key.startsWith('fixflags:agent:'))).toBe(false)
  })

  it('preserves an unsent support draft across close and reopen without reading Site evidence', async () => {
    render(<SupportProvider><SupportWidget /></SupportProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Open live chat' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Support message' }), { target: { value: 'Keep my question' } })
    fireEvent.click(screen.getByRole('button', { name: 'Close chat' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open live chat' }))
    expect(await screen.findByRole('textbox', { name: 'Support message' })).toHaveValue('Keep my question')
    expect(fetch).not.toHaveBeenCalled()
  })
})
