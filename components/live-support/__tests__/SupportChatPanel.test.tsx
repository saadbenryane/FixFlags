/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SupportChatPanel } from '@/components/live-support/SupportChatPanel'
import type { SupportMessageDto } from '@/lib/live-support/types'
import { SUPPORT_CHAT as C } from '@/lib/marketing/copy-barrel'

const setSessionId = vi.fn()
const clearDraftPrefill = vi.fn()
const context = vi.hoisted(() => ({ sessionId: null as string | null,
  data: { messages: [] } as { messages: SupportMessageDto[] } | undefined,
  error: undefined as Error | undefined, isValidating: false, mutate: vi.fn(),
}))

vi.mock('@/components/live-support/SupportProvider', () => ({
  useSupportContext: () => ({
    sessionId: context.sessionId,
    setSessionId,
    auditId: null,
    panelOpen: true,
    draftPrefill: null,
    clearDraftPrefill,
  }),
}))

vi.mock('@/components/live-support/useSupportPolling', () => ({
  useSupportMessages: () => context,
}))

describe('SupportChatPanel create-on-first-message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    context.sessionId = null
    context.data = { messages: [] }
    context.error = undefined
    context.isValidating = false
    context.mutate.mockResolvedValue(undefined)
    global.fetch = vi.fn()
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('shows local welcome without creating a session', () => {
    render(<SupportChatPanel />)
    expect(screen.getByText(/You're chatting with the FixFlags team/i)).toBeTruthy()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('acknowledges only the last loaded message sequence after a successful read', async () => {
    context.sessionId = 'session'
    context.data = undefined
    const onRead = vi.fn()
    vi.mocked(fetch).mockResolvedValue(Response.json({ ok: true }))
    const rendered = render(<SupportChatPanel onRead={onRead} />)
    expect(fetch).not.toHaveBeenCalled()
    context.data = { messages: [{ id: 'reply', role: 'AGENT', body: 'Recorded reply', sequence: '7', createdAt: '2026-11-03T12:00:00Z' }] }
    rendered.rerender(<SupportChatPanel onRead={onRead} />)
    await waitFor(() => expect(onRead).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/support/sessions/session/messages', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ through: '7' }), signal: expect.any(AbortSignal),
    }))
    context.error = new Error('Read unavailable')
    rendered.rerender(<SupportChatPanel onRead={onRead} />)
    expect(screen.getByText('Recorded reply')).toBeVisible()
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('retires an unread acknowledgement callback when its conversation view closes', async () => {
    context.sessionId = 'session'
    context.data = { messages: [{ id: 'reply', role: 'AGENT', body: 'Recorded reply', sequence: '7', createdAt: '2026-11-03T12:00:00Z' }] }
    let finish!: (response: Response) => void
    let signal!: AbortSignal
    const onRead = vi.fn()
    vi.mocked(fetch).mockImplementation((_url, options) => {
      signal = options!.signal as AbortSignal
      return new Promise<Response>(resolve => { finish = resolve })
    })
    const rendered = render(<SupportChatPanel onRead={onRead} />)
    expect(signal.aborted).toBe(false)
    rendered.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => { finish(Response.json({ ok: true })) })
    expect(onRead).not.toHaveBeenCalled()
  })

  it.each(['empty', 'retained'] as const)('retries a failed %s conversation read without sending or marking unread messages as read', async mode => {
    context.sessionId = 'session'
    context.error = new Error('Read unavailable')
    if (mode === 'retained') context.data = { messages: [{ id: 'reply', role: 'AGENT', body: 'Recorded reply', sequence: '7', createdAt: '2026-11-03T12:00:00Z' }] }
    const rendered = render(<SupportChatPanel />)
    expect(screen.getByText(C.readError)).toBeVisible()
    const retry = screen.getByRole('button', { name: C.retryMessages })
    fireEvent.click(retry)
    expect(context.mutate).toHaveBeenCalledOnce()
    expect(fetch).not.toHaveBeenCalled()
    context.isValidating = true
    rendered.rerender(<SupportChatPanel />)
    expect(retry).toBeDisabled()
    expect(retry).toHaveTextContent(C.loadingMessages)
    fireEvent.click(retry)
    expect(context.mutate).toHaveBeenCalledOnce()
    if (mode === 'retained') expect(screen.getByText('Recorded reply')).toBeVisible()
  })

  it('POSTs firstMessage to create a session on send', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ session: { id: 'sess_new' } }),
    })

    render(<SupportChatPanel />)
    const input = screen.getByPlaceholderText('Type a message…')
    fireEvent.change(input, { target: { value: 'Need help with billing' } })
    fireEvent.click(screen.getByLabelText('Send message'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/support/sessions',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"firstMessage":"Need help with billing"'),
        })
      )
    })
    expect(setSessionId).toHaveBeenCalledWith('sess_new')
  })

  it.each(['new', 'existing'] as const)('keeps a newer editable draft after a message in a %s session is accepted', async mode => {
    if (mode === 'existing') context.sessionId = 'sess_existing'
    let finish!: (response: Response) => void
    vi.mocked(fetch).mockImplementation((_url, options) => options?.method === 'PATCH'
      ? Promise.resolve(Response.json({})) : new Promise<Response>(resolve => { finish = resolve }))
    render(<SupportChatPanel />)
    const input = screen.getByRole('textbox', { name: 'Support message' })
    fireEvent.change(input, { target: { value: 'My first question.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    fireEvent.change(input, { target: { value: 'Keep this follow-up question.' } })
    await act(async () => { finish(Response.json({ session: { id: 'sess_new' } })) })
    if (mode === 'new') expect(setSessionId).toHaveBeenCalledWith('sess_new')
    else expect(setSessionId).not.toHaveBeenCalled()
    expect(input).toHaveValue('Keep this follow-up question.')
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled()
  })
})
