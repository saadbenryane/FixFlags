import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupportProvider, useSupportContext } from '@/components/live-support/SupportProvider'
import { SiteChatWidget } from '../SiteChatWidget'

const polling = vi.hoisted(() => ({ unread: 3, messages: vi.fn(), mutate: vi.fn() }))
vi.mock('@/components/live-support/useSupportPolling', () => ({
  useSupportSession: () => ({ data: { session: { id: 'support-1', unreadByVisitor: polling.unread } }, mutate: polling.mutate }),
  useSupportMessages: (sessionId: string | null, active: boolean) => {
    polling.messages(sessionId, active)
    return { data: { messages: [] }, mutate: vi.fn() }
  },
}))
const history = { threadId: 'thread-1', messages: [] }
const reply = { reply: 'The cart remained empty.', citations: [], threadId: 'thread-1', messageId: 'reply-1', createdAt: '2026-10-12T09:00:00Z' }
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })
function Escalate() {
  const support = useSupportContext()
  return <button onClick={() => support.openSupportChat({ prefill: 'Billing help' })}>Contact support</button>
}
function Fixture({ owner = true, siteId = 'site-1', flagId }: { owner?: boolean; siteId?: string; flagId?: string }) {
  return <SupportProvider><Escalate /><SiteChatWidget key={`${siteId}:${flagId}:${owner}`} siteId={siteId} host="example.com"
    ownsSite={owner} flagId={flagId} flagTitle={flagId ? 'Cart remained empty' : undefined} /></SupportProvider>
}
async function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Open FixFlags chat' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'What needs attention?' })).toBeVisible())
}

beforeEach(() => {
  sessionStorage.clear()
  polling.messages.mockClear()
  polling.mutate.mockClear()
  vi.stubGlobal('fetch', vi.fn(async () => response(history)))
})
afterEach(() => vi.unstubAllGlobals())

describe('shared Site chat', () => {
  it('reveals an obscured background control without stealing its focus or discarding the draft', async () => {
    render(<Fixture />)
    await open()
    const question = screen.getByRole('textbox', { name: 'Your question' })
    fireEvent.change(question, { target: { value: 'Keep this question' } })
    const panel = document.getElementById('site-chat-window')!
    const target = screen.getByRole('button', { name: 'Contact support' })
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({ left: 400, right: 800, top: 100, bottom: 600 } as DOMRect)
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ left: 500, right: 600, top: 200, bottom: 244 } as DOMRect)
    target.focus()
    await waitFor(() => expect(document.getElementById('site-chat-window')).toBeNull())
    await waitFor(() => expect(target).toHaveFocus())
    await open()
    expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveValue('Keep this question')
  })
  it('opens one modeless window, exposes context and preserves drafts between views and close', async () => {
    render(<Fixture flagId="flag-1" />)
    expect(screen.getAllByRole('button', { name: 'Open FixFlags chat' })).toHaveLength(1)
    expect(screen.getByLabelText('3 unread support messages')).toBeVisible()
    await open()
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('example.com')).toBeVisible()
    expect(screen.getByText('Cart remained empty')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'What needs attention?' }))
    expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveValue('What needs attention?')
    expect(vi.mocked(fetch).mock.calls.every(call => call[1]?.method !== 'POST')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Support' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Support message' }), { target: { value: 'Help with my account' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask about this website' }))
    expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveValue('What needs attention?')
    fireEvent.click(screen.getByRole('button', { name: 'Support' }))
    expect(screen.getByRole('textbox', { name: 'Support message' })).toHaveValue('Help with my account')
    fireEvent.click(screen.getByRole('button', { name: 'Close FixFlags chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open FixFlags chat' }))
    expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveValue('What needs attention?')
    fireEvent.click(screen.getByRole('button', { name: 'Support' }))
    expect(screen.getByRole('textbox', { name: 'Support message' })).toHaveValue('Help with my account')
  })

  it('opens support directly with a prefill and never loads evidence for nonowners', async () => {
    render(<Fixture owner={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
    expect(screen.getByRole('textbox', { name: 'Support message' })).toHaveValue('Billing help')
    expect(screen.queryByRole('tab', { name: 'Site questions' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ask about this website' })).not.toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.some(call => String(call[0]).includes('/agent'))).toBe(false)
  })

  it('does not read support messages while the site conversation is showing', async () => {
    render(<Fixture />)
    await open()
    expect(polling.messages).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Support' }))
    expect(polling.messages).toHaveBeenCalledWith('support-1', true)
    await waitFor(() => expect(polling.mutate).toHaveBeenCalled())
    polling.messages.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Ask about this website' }))
    expect(polling.messages).not.toHaveBeenCalled()
  })

  it('renders the submitted turn immediately and reconciles its stored identity without duplicates', async () => {
    let resolvePost!: (value: ReturnType<typeof response>) => void
    let requestKey = ''
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      if (options?.method === 'POST') {
        requestKey = options.headers['Idempotency-Key']
        return new Promise(resolve => { resolvePost = resolve })
      }
      return response(requestKey ? { threadId: 'thread-1', messages: [
        { id: 'user-1', role: 'user', content: 'Explain checkout', citations: [], createdAt: reply.createdAt, requestKey },
        { id: reply.messageId, role: 'assistant', content: reply.reply, citations: [], createdAt: reply.createdAt, requestKey },
      ] } : history)
    }))
    render(<Fixture />)
    await open()
    fireEvent.change(screen.getByRole('textbox', { name: 'Your question' }), { target: { value: 'Explain checkout' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }))
    expect(within(screen.getByRole('list', { name: 'Site questions' })).getByText('Explain checkout')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Preparing your reply')
    resolvePost(response(reply))
    await screen.findByText(reply.reply)
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(screen.getAllByText('Explain checkout')).toHaveLength(1)
    expect(screen.getAllByText(reply.reply)).toHaveLength(1)
  })

  it('sends with Enter, preserves Shift+Enter, and never submits during IME composition', async () => {
    const fetch = vi.fn(async (_url: string, options?: RequestInit) => response(options?.method === 'POST' ? reply : history))
    vi.stubGlobal('fetch', fetch)
    render(<Fixture />)
    await open()
    const input = screen.getByRole('textbox', { name: 'Your question' })
    fireEvent.change(input, { target: { value: 'Explain checkout' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    fireEvent.compositionStart(input)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(fetch.mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(0)
    fireEvent.compositionEnd(input)
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(fetch.mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(1))
  })

  it('retains drafts on failed history and restores focus on Escape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({}, 503)))
    render(<Fixture />)
    fireEvent.click(screen.getByRole('button', { name: 'Open FixFlags chat' }))
    await screen.findByRole('button', { name: 'Reload conversation' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Your question' }), { target: { value: 'My saved question' } })
    expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Open FixFlags chat' })).toHaveFocus()
    expect(sessionStorage.getItem('fixflags:agent:site-1:site:draft')).toBe('My saved question')
  })

  it('ignores an aborted old-context read and isolates drafts after a Site change', async () => {
    let resolveOld!: (value: ReturnType<typeof response>) => void
    vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).includes('site-1')
      ? new Promise(resolve => { resolveOld = resolve }) : response(history)))
    const fixture = render(<Fixture />)
    fireEvent.click(screen.getByRole('button', { name: 'Open FixFlags chat' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Your question' }), { target: { value: 'Site one draft' } })
    fixture.rerender(<Fixture siteId="site-2" />)
    await open()
    resolveOld(response({ threadId: 'old', messages: [{ id: 'private', role: 'assistant', content: 'Old Site evidence', citations: [], createdAt: reply.createdAt }] }))
    await waitFor(() => expect(screen.queryByText('Old Site evidence')).not.toBeInTheDocument())
    expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveValue('')
    expect(sessionStorage.getItem('fixflags:agent:site-1:site:draft')).toBe('Site one draft')
  })

  it('reconciles a saved reply after an interrupted send without issuing another POST', async () => {
    let requestKey = ''
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      if (options?.method === 'POST') {
        requestKey = options.headers['Idempotency-Key']
        throw new Error('lost response')
      }
      return response(requestKey ? { threadId: 'thread-1', messages: [
        { id: 'user-1', role: 'user', content: 'My retained message', citations: [], requestKey, createdAt: reply.createdAt },
        { id: reply.messageId, role: 'assistant', content: reply.reply, citations: [], requestKey, createdAt: reply.createdAt },
      ] } : history)
    }))
    render(<Fixture />)
    await open()
    fireEvent.change(screen.getByRole('textbox', { name: 'Your question' }), { target: { value: 'My retained message' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }))
    await screen.findByRole('button', { name: 'Recover reply' })
    fireEvent.click(screen.getByRole('button', { name: 'Close FixFlags chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open FixFlags chat' }))
    await screen.findByText(reply.reply)
    expect(screen.getAllByText('My retained message')).toHaveLength(1)
    expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveValue('')
    expect(sessionStorage.getItem('fixflags:agent:site-1:site')).toBeNull()
    expect(vi.mocked(fetch).mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(1)
  })

  it('rejects cross-Site reply citations and retains the exact recovery intent', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => response(options?.method === 'POST'
      ? { ...reply, citations: [{ type: 'flag', id: 'flag-2', label: 'Other evidence', href: '/sites/other-site/flags/flag-2' }] } : history)))
    render(<Fixture />)
    await open()
    fireEvent.change(screen.getByRole('textbox', { name: 'Your question' }), { target: { value: 'Explain my evidence' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }))
    await screen.findByRole('button', { name: 'Recover reply' })
    expect(screen.queryByRole('link', { name: 'Other evidence' })).not.toBeInTheDocument()
    expect(screen.queryByText(reply.reply)).not.toBeInTheDocument()
    const saved = JSON.parse(sessionStorage.getItem('fixflags:agent:site-1:site')!)
    expect(saved.message).toBe('Explain my evidence')
    expect(saved.requestKey).toBe((vi.mocked(fetch).mock.calls.find(call => call[1]?.method === 'POST')![1]!.headers as Record<string, string>)['Idempotency-Key'])
  })

  it('keeps support sends owned while closed and shows a retained failure on return', async () => {
    let resolvePost!: (value: ReturnType<typeof response>) => void
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => options?.method === 'POST'
      ? new Promise(resolve => { resolvePost = resolve }) : response(history)))
    render(<Fixture />)
    fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close FixFlags chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    expect(vi.mocked(fetch).mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Ask about this website' }))
    resolvePost(response({ message: 'Support is temporarily unavailable' }, 503))
    fireEvent.click(screen.getByRole('button', { name: 'Support' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Support is temporarily unavailable')
    expect(screen.getByRole('textbox', { name: 'Support message' })).toHaveValue('Billing help')
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled()
  })

  it('retains a confirmed pair if refreshing the saved history fails', async () => {
    let posted = false
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      if (options?.method === 'POST') { posted = true; return response(reply) }
      return response(posted ? {} : history, posted ? 503 : 200)
    }))
    render(<Fixture />)
    await open()
    fireEvent.change(screen.getByRole('textbox', { name: 'Your question' }), { target: { value: 'Explain checkout' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }))
    await screen.findByRole('button', { name: 'Reload conversation' })
    expect(screen.getByText('Explain checkout')).toBeVisible()
    expect(screen.getByText(reply.reply)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Recover reply' })).not.toBeInTheDocument()
  })

  it('traps mobile focus and gives the modal an accessible title', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    render(<Fixture />)
    await open()
    expect(screen.getByRole('dialog', { name: 'FixFlags' })).toHaveAttribute('aria-modal', 'true')
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close FixFlags chat' })).toBeVisible()
    expect(within(screen.getByRole('dialog')).queryByRole('tab')).not.toBeInTheDocument()
    screen.getByRole('textbox', { name: 'Your question' }).focus()
    screen.getByText('Contact support').focus()
    await waitFor(() => expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true))
  })
})
