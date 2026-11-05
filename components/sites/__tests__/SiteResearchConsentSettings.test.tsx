import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SiteResearchConsentSettings } from '../SiteResearchConsentSettings'
import { RESEARCH_CONSENT_COPY as C } from '@/lib/marketing/copy/research'
import { RESEARCH_CONSENT_VERSION } from '@/lib/growth/research-consent-contract'
const response = (enabled: boolean, ok = true) => ({ ok, json: async () => ({ enabled, policyVersion: RESEARCH_CONSENT_VERSION, grantedAt: enabled ? '2026-10-13T10:00:00Z' : null }) })
afterEach(() => vi.unstubAllGlobals())
describe('research permission in Site settings', () => {
  it.each(['headers', 'body'] as const)('bounds an unreadable permission through stalled %s and retries without inventing an off state', async phase => {
    vi.useFakeTimers()
    let finish!: (value: unknown) => void, signal!: AbortSignal
    const fetcher = vi.fn().mockImplementationOnce((_url, options) => {
      signal = options.signal
      if (phase === 'headers') return new Promise<Response>(resolve => { finish = body => resolve(Response.json(body)) })
      return Promise.resolve({ ok: true, json: () => new Promise(resolve => { finish = resolve }) } as Response)
    }).mockResolvedValueOnce(response(true))
    vi.stubGlobal('fetch', fetcher)
    const view = render(<SiteResearchConsentSettings siteId="site" />)
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
      expect(signal.aborted).toBe(true)
      expect(screen.getByRole('alert')).toHaveTextContent(C.unavailable)
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: C.retry })) })
      expect(screen.getByRole('checkbox', { name: C.choice })).toBeChecked()
      await act(async () => { finish({ enabled: false, policyVersion: RESEARCH_CONSENT_VERSION, grantedAt: null }) })
      expect(screen.getByRole('checkbox', { name: C.choice })).toBeChecked()
      expect(fetcher).toHaveBeenCalledTimes(2)
    } finally { view.unmount(); vi.useRealTimers() }
  })

  it.each(['headers', 'body'] as const)('bounds an unconfirmed withdrawal through stalled %s and checks the saved choice on retry', async phase => {
    vi.useFakeTimers()
    let finish!: (value: unknown) => void, signal!: AbortSignal
    const fetcher = vi.fn().mockResolvedValueOnce(response(true)).mockImplementationOnce((_url, options) => {
      signal = options.signal
      if (phase === 'headers') return new Promise<Response>(resolve => { finish = body => resolve(Response.json(body)) })
      return Promise.resolve({ ok: true, json: () => new Promise(resolve => { finish = resolve }) } as Response)
    }).mockResolvedValueOnce(response(false))
    vi.stubGlobal('fetch', fetcher)
    const view = render(<SiteResearchConsentSettings siteId="site" />)
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      const checkbox = screen.getByRole('checkbox', { name: C.choice })
      fireEvent.click(checkbox)
      expect(checkbox).toBeDisabled()
      expect(checkbox).toHaveAttribute('aria-busy', 'true')
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
      expect(signal.aborted).toBe(true)
      expect(screen.getAllByText(C.failed)).toHaveLength(1)
      expect(screen.getByRole('alert')).toHaveTextContent(C.failed)
      expect(checkbox).toBeChecked()
      expect(checkbox).toBeEnabled()
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: C.retry })) })
      expect(screen.getByRole('checkbox', { name: C.choice })).not.toBeChecked()
      await act(async () => { finish({ enabled: false, policyVersion: RESEARCH_CONSENT_VERSION, grantedAt: null }) })
      expect(screen.queryByText(C.saved)).not.toBeInTheDocument()
      expect(fetcher.mock.calls[2][1]).not.toHaveProperty('method', 'PATCH')
    } finally { view.unmount(); vi.useRealTimers() }
  })

  it('retires a previous Site’s pending write and never publishes its confirmation into the next Site', async () => {
    let finish!: (value: unknown) => void, signal!: AbortSignal
    const fetcher = vi.fn().mockResolvedValueOnce(response(false)).mockImplementationOnce((_url, options) => {
      signal = options.signal
      return new Promise<Response>(resolve => { finish = body => resolve(Response.json(body)) })
    }).mockResolvedValueOnce(response(false))
    vi.stubGlobal('fetch', fetcher)
    const view = render(<SiteResearchConsentSettings siteId="first" />)
    fireEvent.click(await screen.findByRole('checkbox', { name: C.choice }))
    view.rerender(<SiteResearchConsentSettings siteId="next" />)
    expect(signal.aborted).toBe(true)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    const checkbox = await screen.findByRole('checkbox', { name: C.choice })
    await act(async () => { finish({ enabled: true, policyVersion: RESEARCH_CONSENT_VERSION, grantedAt: '2026-11-03T12:00:00Z' }) })
    expect(checkbox).not.toBeChecked()
    expect(screen.queryByText(C.saved)).not.toBeInTheDocument()
    expect(fetcher.mock.calls[2][0]).toBe('/api/sites/next/research-consent')
  })

  it.each([
    { enabled: false, policyVersion: RESEARCH_CONSENT_VERSION, grantedAt: null },
    { enabled: true, policyVersion: 'unknown-policy', grantedAt: '2026-11-03T12:00:00Z' },
  ])('refuses an enabling receipt with different intent or policy: %j', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(false)).mockResolvedValueOnce(Response.json(body)))
    render(<SiteResearchConsentSettings siteId="site" />)
    fireEvent.click(await screen.findByRole('checkbox', { name: C.choice }))
    expect(await screen.findByRole('alert')).toHaveTextContent(C.failed)
    expect(screen.getByRole('checkbox', { name: C.choice })).not.toBeChecked()
    expect(screen.queryByText(C.saved)).not.toBeInTheDocument()
  })

  it('shows the optional scope, defaults to the saved off state, and sends the current policy', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(false)).mockResolvedValueOnce(response(true)).mockResolvedValueOnce(response(false))
    vi.stubGlobal('fetch', fetch)
    render(<SiteResearchConsentSettings siteId="site" />)
    const checkbox = await screen.findByRole('checkbox', { name: C.choice })
    expect(checkbox).not.toBeChecked()
    expect(screen.getByText(C.boundary)).toBeVisible(); expect(screen.getByText(C.withdrawal)).toBeVisible()
    fireEvent.click(checkbox)
    await waitFor(() => expect(checkbox).toBeChecked())
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/sites/site/research-consent', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ enabled: true, policyVersion: RESEARCH_CONSENT_VERSION }),
    }))
    fireEvent.click(checkbox)
    await waitFor(() => expect(checkbox).not.toBeChecked())
  })
  it('does not claim a successful withdrawal when the save is unconfirmed, and can reread it', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(true)).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(response(false))
    vi.stubGlobal('fetch', fetch)
    render(<SiteResearchConsentSettings siteId="site" />)
    const checkbox = await screen.findByRole('checkbox', { name: C.choice })
    fireEvent.click(checkbox)
    expect(await screen.findByRole('alert')).toHaveTextContent(C.failed)
    expect(checkbox).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: C.retry }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: C.choice })).not.toBeChecked())
  })
  it('does not display an unknown permission as an off choice', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(false, false)))
    render(<SiteResearchConsentSettings siteId="site" />)
    expect(await screen.findByRole('alert')).toHaveTextContent(C.unavailable)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
