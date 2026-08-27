/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SupportChatPanel } from '@/components/live-support/SupportChatPanel'

const setSessionId = vi.fn()
const clearDraftPrefill = vi.fn()

vi.mock('@/components/live-support/SupportProvider', () => ({
  useSupportContext: () => ({
    sessionId: null,
    setSessionId,
    auditId: null,
    panelOpen: true,
    draftPrefill: null,
    clearDraftPrefill,
  }),
}))

vi.mock('@/components/live-support/useSupportPolling', () => ({
  useSupportMessages: () => ({
    data: { messages: [] },
    mutate: vi.fn(),
    error: undefined,
  }),
}))

describe('SupportChatPanel create-on-first-message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('shows local welcome without creating a session', () => {
    render(<SupportChatPanel />)
    expect(screen.getByText(/You're chatting with the FixFlags team/i)).toBeTruthy()
    expect(global.fetch).not.toHaveBeenCalled()
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
})
