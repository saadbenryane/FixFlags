import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupportProvider } from '../SupportProvider'
import { SupportWidget } from '../SupportWidget'

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
