import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { SiteChatWidget } from '../SiteChatWidget'
import { SupportProvider } from '@/components/live-support/SupportProvider'
import { SiteWorkspaceLocationProvider } from '../SiteWorkspaceLocation'
import { SITE_AGENT_COPY as C } from '@/lib/marketing/copy/site-agent'

vi.mock('@/components/live-support/useSupportPolling', () => ({
  useSupportSession: () => ({ data: { session: null }, mutate: vi.fn() }),
  useSupportMessages: () => ({ data: { messages: [] }, mutate: vi.fn() }),
}))
function SiteAgent({ siteId, flagId }: { siteId: string; flagId?: string }) {
  return <SupportProvider><SiteChatWidget siteId={siteId} flagId={flagId} host="example.com" ownsSite ownerId="owner" /></SupportProvider>
}

const history = { threadId: 'thread-1', messages: [] }
const receipt = { reply: 'The cart remained empty in the recorded check.', citations: [{ type: 'flag', id: 'flag-1', label: 'Cart evidence', href: '/sites/site-1/flags/flag-1' }],
  threadId: 'thread-1', messageId: 'reply-1', createdAt: '2026-10-11T09:00:00Z' }
const response = (value: unknown, status = 200) => ({ ok: status < 400, status, json: async () => value })

beforeEach(() => sessionStorage.clear())
afterEach(() => vi.unstubAllGlobals())
describe('contextual Ask FixFlags', () => {
  it.each(['latest', 'earlier'] as const)('preserves the reader at %s messages when the transcript viewport shrinks', async position => {
    const observers = new Map<Element, ResizeObserverCallback>()
    vi.stubGlobal('ResizeObserver', class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(element: Element) { observers.set(element, this.callback) }
      disconnect() {}
    })
    vi.stubGlobal('fetch', vi.fn(async () => response({ threadId: 'thread-1', messages: [{ id: 'reply-1', role: 'assistant',
      content: receipt.reply, citations: [], createdAt: receipt.createdAt }] })))
    render(<SiteAgent siteId="site-1" />)
    fireEvent.click(screen.getByRole('button', { name: C.openChat }))
    await screen.findByText(receipt.reply)
    const transcript = screen.getByRole('list', { name: C.siteQuestions }).parentElement!
    let height = 300
    let offset = position === 'latest' ? 700 : 200
    Object.defineProperty(transcript, 'scrollHeight', { configurable: true, get: () => 1000 })
    Object.defineProperty(transcript, 'clientHeight', { configurable: true, get: () => height })
    Object.defineProperty(transcript, 'scrollTop', { configurable: true, get: () => offset, set: value => { offset = Math.max(0, Math.min(value, 1000 - height)) } })
    fireEvent.scroll(transcript)
    height = 120
    act(() => observers.get(transcript)?.([], {} as ResizeObserver))
    expect(transcript.scrollTop).toBe(position === 'latest' ? 880 : 200)
  })

  it('moves a suggested question into the composer without sending it', async () => {
    const fetch = vi.fn(async () => response(history))
    vi.stubGlobal('fetch', fetch)
    render(<SiteAgent siteId="site-1" />)
    fireEvent.click(screen.getByRole('button', { name: C.openChat }))
    const suggestion = await screen.findByRole('button', { name: C.suggestions[0] })
    suggestion.focus()
    fireEvent.click(suggestion)
    const composer = screen.getByRole('textbox', { name: C.question })
    expect(composer).toHaveValue(C.suggestions[0])
    expect(composer).toHaveFocus()
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/sites/site-1/agent', expect.objectContaining({ cache: 'no-store' }))
  })

  it('returns focus to the editable draft when choosing a new message after an interrupted reply', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') throw new Error('lost response')
      return response(history)
    }))
    render(<SiteAgent siteId="site-1" />)
    fireEvent.click(screen.getByRole('button', { name: C.openChat }))
    const composer = await screen.findByRole('textbox', { name: C.question })
    fireEvent.change(composer, { target: { value: 'Explain the recorded problem.' } })
    await waitFor(() => expect(screen.getByRole('button', { name: C.send })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: C.send }))
    const next = await screen.findByRole('button', { name: C.newMessage })
    expect(composer).toBeDisabled()
    next.focus()
    fireEvent.click(next)
    expect(composer).toBeEnabled()
    expect(composer).toHaveValue('Explain the recorded problem.')
    expect(composer).toHaveFocus()
  })

  it.each([
    { viewMode: 'pages' as const, selectedCard: null, suffix: '?view=pages' },
    { viewMode: 'timeline' as const, selectedCard: null, suffix: '?view=timeline' },
    { viewMode: 'home' as const, selectedCard: 'search' as const, suffix: '?view=home&category=search' },
  ])('retains $viewMode context and the precise attempt when opening cited evidence', async ({ viewMode, selectedCard, suffix }) => {
    const cited = { ...receipt, citations: [{ ...receipt.citations[0], type: 'attempt', id: 'attempt-1',
      href: '/sites/site-1/flags/flag-1#attempt-1' }] }
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => response(options?.method === 'POST' ? cited : history)))
    render(<SiteWorkspaceLocationProvider value={{ siteId: 'site-1', viewMode, selectedCard }}><SiteAgent siteId="site-1" /></SiteWorkspaceLocationProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Open FixFlags chat' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Your question' }), { target: { value: 'Show the comparison evidence.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }))
    expect(await screen.findByRole('link', { name: 'Cart evidence' })).toHaveAttribute('href', `/sites/site-1/flags/flag-1${suffix}#attempt-1`)
  })

  it('lets the customer ask the next question while a completed reply is still reconciling with saved history', async () => {
    let reads = 0, posts = 0
    const historySignals: AbortSignal[] = []
    const fetch = vi.fn((_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve(response({ ...receipt, messageId: `reply-${++posts}` }))
      if (++reads === 1) return Promise.resolve(response(history))
      historySignals.push(options!.signal!)
      return new Promise<Response>(() => {})
    })
    vi.stubGlobal('fetch', fetch)
    const view = render(<SiteAgent siteId="site-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open FixFlags chat' }))
    const composer = await screen.findByRole('textbox', { name: 'Your question' })
    fireEvent.change(composer, { target: { value: 'Why was the cart flagged?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }))
    expect(await screen.findByText(receipt.reply)).toBeVisible()
    await waitFor(() => expect(composer).toBeEnabled())
    expect(historySignals).toHaveLength(1)
    fireEvent.change(composer, { target: { value: 'What should I change?' } })
    const send = screen.getByRole('button', { name: 'Send question' })
    expect(send).toBeEnabled()
    fireEvent.click(send)
    await waitFor(() => expect(posts).toBe(2))
    expect(historySignals[0].aborted).toBe(true)
    view.unmount()
  })

  it('sends authorized Flag context and renders the recorded evidence links', async () => {
    const fetch = vi.fn(async (_url: string, options?: RequestInit) => response(options?.method === 'POST' ? receipt : history))
    vi.stubGlobal('fetch', fetch)
    render(<SiteAgent siteId="site-1" flagId="flag-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open FixFlags chat' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Your question' }), { target: { value: 'Why was the cart flagged?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }))
    await waitFor(() => expect(fetch.mock.calls.some(call => call[1]?.method === 'POST')).toBe(true))
    const posted = fetch.mock.calls.find(call => call[1]?.method === 'POST')![1]!
    expect(JSON.parse(posted.body as string)).toEqual({ message: 'Why was the cart flagged?', flagId: 'flag-1' })
    expect((posted.headers as Record<string, string>)['Idempotency-Key']).toMatch(/^web:/)
    expect(await screen.findByText(receipt.reply)).toBeVisible()
    expect(screen.getByText('Why was the cart flagged?')).toBeVisible()
  })

  it('preserves an interrupted message through refresh and retries its exact intent', async () => {
    let postedKey = ''
    const fetch = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') { postedKey = (options.headers as Record<string, string>)['Idempotency-Key']; throw new Error('lost response') }
      return response(history)
    })
    vi.stubGlobal('fetch', fetch)
    const first = render(<SiteAgent siteId="site-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open FixFlags chat' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Your question' }), { target: { value: 'Explain the current evidence.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }))
    await screen.findByRole('button', { name: 'Recover reply' })
    const originalKey = postedKey
    first.unmount()
    const recovered = render(<SiteAgent siteId="site-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open FixFlags chat' }))
    expect(await screen.findByRole('textbox', { name: 'Your question' })).toHaveValue('Explain the current evidence.')
    fireEvent.click(screen.getByRole('button', { name: 'Recover reply' }))
    await waitFor(() => expect(fetch.mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(2))
    expect(postedKey).toBe(originalKey)
    recovered.unmount()
  })

  it('does not render a malformed or cross-Site stored citation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ threadId: 'thread-1', messages: [{ id: 'reply-1', role: 'assistant', content: 'Private evidence',
      citations: [{ ...receipt.citations[0], href: '/sites/other-site/flags/flag-1' }], createdAt: receipt.createdAt }] })))
    render(<SiteAgent siteId="site-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open FixFlags chat' }))
    expect(await screen.findByRole('button', { name: 'Reload conversation' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Cart evidence' })).not.toBeInTheDocument()
  })
})
