import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { SiteAgent } from '../SiteAgent'

const history = { threadId: 'thread-1', messages: [] }
const receipt = { reply: 'The cart remained empty in the recorded check.', citations: [{ type: 'flag', id: 'flag-1', label: 'Cart evidence', href: '/sites/site-1/flags/flag-1' }],
  threadId: 'thread-1', messageId: 'reply-1', createdAt: '2026-10-11T09:00:00Z' }
const response = (value: unknown, status = 200) => ({ ok: status < 400, status, json: async () => value })

beforeEach(() => sessionStorage.clear())
afterEach(() => vi.unstubAllGlobals())
describe('contextual Ask FixFlags', () => {
  it('sends authorized Flag context and renders the recorded evidence links', async () => {
    const fetch = vi.fn(async (_url: string, options?: RequestInit) => response(options?.method === 'POST' ? receipt : history))
    vi.stubGlobal('fetch', fetch)
    render(<SiteAgent siteId="site-1" flagId="flag-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ask FixFlags' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Your question' }), { target: { value: 'Why was the cart flagged?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }))
    await waitFor(() => expect(fetch.mock.calls.some(call => call[1]?.method === 'POST')).toBe(true))
    const posted = fetch.mock.calls.find(call => call[1]?.method === 'POST')![1]!
    expect(JSON.parse(posted.body as string)).toEqual({ message: 'Why was the cart flagged?', flagId: 'flag-1' })
    expect((posted.headers as Record<string, string>)['Idempotency-Key']).toMatch(/^web:/)
    await waitFor(() => expect(screen.getByText('Your reply is ready.')).toBeVisible())
  })

  it('preserves an interrupted message through refresh and retries its exact intent', async () => {
    let postedKey = ''
    const fetch = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') { postedKey = (options.headers as Record<string, string>)['Idempotency-Key']; throw new Error('lost response') }
      return response(history)
    })
    vi.stubGlobal('fetch', fetch)
    const first = render(<SiteAgent siteId="site-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ask FixFlags' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Your question' }), { target: { value: 'Explain the current evidence.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }))
    await screen.findByRole('button', { name: 'Recover reply' })
    const originalKey = postedKey
    first.unmount()
    const recovered = render(<SiteAgent siteId="site-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ask FixFlags' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Ask FixFlags' }))
    expect(await screen.findByRole('button', { name: 'Reload conversation' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Cart evidence' })).not.toBeInTheDocument()
  })
})
