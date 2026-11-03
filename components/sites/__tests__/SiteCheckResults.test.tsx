import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SiteCheckResults } from '../SiteCheckResults'
import type { SiteCheckResult } from '@/lib/sites/check-results'

function result(id: string, area: SiteCheckResult['area'] = 'search', auditId = 'a'): SiteCheckResult {
  return { id, area, auditId, name: id, kind: 'assertion', status: 'observed', pageUrl: 'https://example.com/',
    checkedAt: '2026-10-14T00:00:00Z', historical: false, limitation: 'Recorded scope', source: 'rendered-dom',
    evidenceReference: { auditId, executionId: 'execution-' + id, pageUrl: 'https://example.com/' } }
}
function response(results: SiteCheckResult[], nextCursor: string | null = null, total: number | null = null) {
  return { ok: true, json: async () => ({ results, nextCursor, total }) } as Response
}
afterEach(() => vi.unstubAllGlobals())

describe('scoped recorded-result interaction', () => {
  it('loads the selected scope and makes continuation and exhaustion visible', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response([result('Search first')], 'cursor-1'))
      .mockResolvedValueOnce(response([result('Search next')]))
    vi.stubGlobal('fetch', fetch)
    render(<SiteCheckResults siteId="owned" area="search" pageUrl="https://example.com/" results={[]} />)
    expect(screen.getByRole('status').textContent).toBe('Loading results…')
    await screen.findByText('Search first')
    const initial = new URL(fetch.mock.calls[0][0], 'https://fixflags.com')
    expect(initial.searchParams.get('area')).toBe('search')
    expect(initial.searchParams.get('pageUrl')).toBe('https://example.com/')
    fireEvent.click(screen.getByRole('button', { name: 'Load more recorded results' }))
    await screen.findByText('Search next')
    expect(new URL(fetch.mock.calls[1][0], 'https://fixflags.com').searchParams.get('cursor')).toBe('cursor-1')
    expect(screen.queryByRole('button', { name: 'Load more recorded results' })).toBeNull()
    expect(screen.getByText('All available results in this scope are shown.')).toBeTruthy()
  })

  it('retains recorded evidence when loading fails and provides a working retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response([result('Fresh result')])))
    render(<SiteCheckResults siteId="owned" area="search" results={[result('Recorded result')]} />)
    await screen.findByRole('button', { name: 'Try loading results again' })
    expect(screen.getByText('Recorded result')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try loading results again' }))
    await screen.findByText('Fresh result')
    expect(screen.queryByText('Recorded result')).toBeNull()
  })

  it('ignores a late request after the category or evidence selection changes', async () => {
    let finishOld: (response: Response) => void = () => {}
    const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finishOld = resolve }))
      .mockResolvedValueOnce(response([result('Accessibility fresh', 'accessibility', 'new')]))
      .mockResolvedValueOnce(response([result('Accessibility newest', 'accessibility', 'newest')]))
    vi.stubGlobal('fetch', fetch)
    const rendered = render(<SiteCheckResults siteId="owned" area="search" results={[result('Original')]} />)
    rendered.rerender(<SiteCheckResults siteId="owned" area="accessibility" results={[result('Selection', 'accessibility', 'new')]} />)
    await screen.findByText('Accessibility fresh')
    finishOld(response([result('Stale Search')], 'stale-cursor'))
    await waitFor(() => expect(screen.queryByText('Stale Search')).toBeNull())
    expect(screen.queryByRole('button', { name: 'Load more recorded results' })).toBeNull()
    rendered.rerender(<SiteCheckResults siteId="owned" area="accessibility" results={[result('New selection', 'accessibility', 'newest')]} />)
    await screen.findByText('Accessibility newest')
    expect(screen.queryByText('Accessibility fresh')).toBeNull()
  })

  it('explains a bounded empty continuation and gives an explicit exhausted empty state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([], 'remaining')).mockResolvedValueOnce(response([])))
    render(<SiteCheckResults siteId="owned" area="security" results={[]} />)
    await screen.findByText('This portion contains no matching results. Continue to inspect the remaining recorded scope.')
    fireEvent.click(screen.getByRole('button', { name: 'Load more recorded results' }))
    await screen.findByText('No recorded results in this scope yet.')
    expect(screen.queryByRole('button', { name: 'Load more recorded results' })).toBeNull()
  })
  it('reloads a changed evidence scope instead of appending it to earlier results', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response([result('Earlier')], 'old-scope', 2))
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ code: 'RESULT_SELECTION_CHANGED' }) })
      .mockResolvedValueOnce(response([result('Newest')], null, 1))
    vi.stubGlobal('fetch', fetch)
    render(<SiteCheckResults siteId="owned" area="search" results={[]} />)
    await screen.findByText('Earlier')
    expect(screen.getByText('1 of 2 recorded results in this scope.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Load more recorded results' }))
    await screen.findByText('Newest')
    expect(screen.queryByText('Earlier')).toBeNull()
    expect(screen.getByText('1 of 1 recorded result in this scope.')).toBeVisible()
    expect(new URL(fetch.mock.calls[2][0], 'https://fixflags.com').searchParams.get('cursor')).toBeNull()
    expect(screen.getByText('The recorded evidence changed. Showing the latest results for this scope.')).toBeVisible()
  })

  it('cancels a paginated read when its scope changes and cannot append its late response', async () => {
    let finish!: (response: Response) => void
    let signal!: AbortSignal
    const fetcher = vi.fn().mockResolvedValueOnce(response([result('Earlier')], 'more'))
      .mockImplementationOnce((_url, options) => { signal = options.signal; return new Promise<Response>(resolve => { finish = resolve }) })
      .mockResolvedValueOnce(response([result('New category', 'accessibility')]))
    vi.stubGlobal('fetch', fetcher)
    const rendered = render(<SiteCheckResults siteId="owned" area="search" results={[]} />)
    await screen.findByText('Earlier')
    fireEvent.click(screen.getByRole('button', { name: 'Load more recorded results' }))
    await waitFor(() => expect(signal).toBeDefined())
    expect(signal.aborted).toBe(false)
    rendered.rerender(<SiteCheckResults siteId="owned" area="accessibility" results={[]} />)
    expect(signal.aborted).toBe(true)
    expect(await screen.findByText('New category')).toBeVisible()
    await act(async () => { finish(response([result('Retired evidence')])); await Promise.resolve() })
    expect(screen.queryByText('Retired evidence')).not.toBeInTheDocument()
    expect(screen.queryByText('Earlier')).not.toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('cancels an unscoped continuation when the evidence view closes', async () => {
    let signal!: AbortSignal
    const fetcher = vi.fn((_url, options) => { signal = options.signal; return new Promise<Response>(() => {}) })
    vi.stubGlobal('fetch', fetcher)
    const rendered = render(<SiteCheckResults siteId="owned" results={[result('Recorded')]} nextCursor="more" />)
    expect(fetcher).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Load more recorded results' }))
    await waitFor(() => expect(signal).toBeDefined())
    rendered.unmount()
    expect(signal.aborted).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
