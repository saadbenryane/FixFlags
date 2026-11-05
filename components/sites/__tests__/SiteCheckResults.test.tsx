import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SiteCheckResults } from '../SiteCheckResults'
import type { SiteCheckResult } from '@/lib/sites/check-result-contract'
import { SearchResults } from '../SearchResults'
import { SITE_DASHBOARD_COPY as D } from '@/lib/marketing/copy/site-dashboard'
import { SEARCH_COPY as S } from '@/lib/marketing/copy/search'
import { SITE_ACTION_COPY as A } from '@/lib/marketing/copy/site-actions'
import { StrictMode, useLayoutEffect, useRef } from 'react'

function result(id: string, area: SiteCheckResult['area'] = 'search', auditId = 'a'): SiteCheckResult {
  return { id, area, auditId, name: id, kind: 'assertion', status: 'observed', pageUrl: 'https://example.com/',
    checkedAt: '2026-10-14T00:00:00Z', historical: false, limitation: 'Recorded scope', source: 'rendered-dom',
    evidenceReference: { auditId, executionId: 'execution-' + id, pageUrl: 'https://example.com/' } }
}
function response(results: SiteCheckResult[], nextCursor: string | null = null, total: number | null = null) {
  return { ok: true, json: async () => ({ results, nextCursor, total }) } as Response
}
function searchResult(index: number): SiteCheckResult {
  const base = result(`Search item ${index}`)
  return { ...base, search: { id: base.id, checkId: 'title', checkVersion: 1, responsibility: 'presentation',
    name: base.name, disposition: 'observed', reason: 'Recorded title', expected: 'A useful title', observed: `Title ${index}`,
    source: 'http', collectedAt: base.checkedAt, pageUrl: base.pageUrl!,
    attention: { policy: 'search', version: 1, kind: 'observation', reason: 'Recorded title' },
    evidence: [], limitation: 'Recorded scope', guidance: '' } }
}
afterEach(() => vi.unstubAllGlobals())

describe('scoped recorded-result interaction', () => {
  it.each(['Site', 'observation'] as const)('commits the new %s context without prior scoped evidence or pagination', async change => {
    const committed: string[] = []
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([result('Prior scoped observation')], 'prior-cursor', 17))
      .mockImplementation(() => new Promise<Response>(() => {})))
    function CommittedResults({ siteId, auditId }: { siteId: string; auditId: string }) {
      const root = useRef<HTMLDivElement>(null)
      useLayoutEffect(() => { committed.push(root.current?.textContent ?? '') }, [siteId, auditId])
      return <div ref={root}><h2>{siteId}: {auditId}</h2><SiteCheckResults siteId={siteId} area="search"
        results={change === 'Site' ? [] : [result('Current source ' + auditId, 'search', auditId)]} /></div>
    }
    const rendered = render(<CommittedResults siteId="first" auditId="a" />)
    try {
      await screen.findByText('Prior scoped observation')
      committed.length = 0
      rendered.rerender(<CommittedResults siteId={change === 'Site' ? 'second' : 'first'} auditId="b" />)
      expect(committed).toHaveLength(1)
      expect(committed[0]).not.toContain('Prior scoped observation')
      expect(committed[0]).not.toContain(A.resultsCount(1, 17))
      expect(screen.queryByText('Prior scoped observation')).not.toBeInTheDocument()
    } finally { rendered.unmount() }
  })

  it('preserves an unchanged recorded result and its reading focus when the source cursor changes', () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const results = [result('Retained recorded result')]
    const rendered = render(<SiteCheckResults siteId="site" results={results} nextCursor="first" />)
    const summary = screen.getByText('Technical details', { selector: 'summary' })
    fireEvent.click(summary)
    summary.focus()
    rendered.rerender(<SiteCheckResults siteId="site" results={results} nextCursor="second" />)
    expect(summary).toHaveFocus()
    expect(summary.closest('details')).toHaveAttribute('open')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('retires the first effect lifetime under Strict Mode without publishing its late read', async () => {
    const reads: Array<{ signal: AbortSignal; finish: (response: Response) => void }> = []
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise<Response>(resolve => {
      reads.push({ signal: options.signal, finish: resolve })
    })))
    const rendered = render(<StrictMode><SiteCheckResults siteId="site" area="search" results={[]} /></StrictMode>)
    try {
      await waitFor(() => expect(reads).toHaveLength(2))
      expect(reads[0].signal.aborted).toBe(true)
      expect(reads[1].signal.aborted).toBe(false)
      await act(async () => { reads[0].finish(response([result('Retired effect evidence')])) })
      expect(screen.queryByText('Retired effect evidence')).not.toBeInTheDocument()
      await act(async () => { reads[1].finish(response([result('Current effect evidence')])) })
      expect(await screen.findByText('Current effect evidence')).toBeVisible()
    } finally { rendered.unmount() }
  })

  it('opens the exact recorded check page while keeping unusable addresses readable', () => {
    const url = 'https://example.com/Plans/?locale=fr#annual'
    const unsafe = 'https://user:secret@example.com/private'
    render(<SiteCheckResults results={[
      { ...result('Measured page', 'performance'), pageUrl: url },
      { ...result('Historical address', 'performance'), pageUrl: unsafe },
    ]} />)
    const link = screen.getByRole('link', { name: D.open(url) })
    expect(link).toHaveAttribute('href', url)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText(unsafe)).toBeVisible()
    expect(screen.queryByRole('link', { name: D.open(unsafe) })).not.toBeInTheDocument()
  })

  it('keeps a Search page separate from its disclosed source address and recorded excerpt', () => {
    const item = searchResult(1)
    const pageUrl = 'https://example.com/Plans/?locale=fr#annual'
    const sourceUrl = 'https://example.com/sitemap.xml?part=2#plans'
    const unsafe = 'javascript:alert(1)'
    render(<SearchResults results={[{ ...item, search: { ...item.search!, pageUrl, evidence: [
      { source: 'sitemap', url: sourceUrl, locator: 'loc', excerpt: 'The recorded page is listed.', collectedAt: item.checkedAt },
      { source: 'http', url: unsafe, locator: 'original address', excerpt: 'Retained evidence.', collectedAt: item.checkedAt },
    ] } }]} />)
    expect(screen.getByRole('link', { name: D.open(pageUrl) })).toHaveAttribute('href', pageUrl)
    expect(screen.getByRole('link', { name: D.open(sourceUrl) })).not.toBeVisible()
    fireEvent.click(screen.getByText(S.evidence, { selector: 'summary' }))
    const source = screen.getByRole('link', { name: D.open(sourceUrl) })
    expect(source).toHaveAttribute('href', sourceUrl)
    expect(source).toHaveAttribute('target', '_blank')
    expect(source).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('The recorded page is listed.')).toBeVisible()
    expect(screen.getByText(unsafe)).toBeVisible()
    expect(screen.queryByRole('link', { name: D.open(unsafe) })).not.toBeInTheDocument()
  })

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

  it('cancels a paginated read and its focus continuation when its scope changes', async () => {
    let finish!: (response: Response) => void
    let signal!: AbortSignal
    const fetcher = vi.fn().mockResolvedValueOnce(response([result('Earlier')], 'more'))
      .mockImplementationOnce((_url, options) => { signal = options.signal; return new Promise<Response>(resolve => { finish = resolve }) })
      .mockResolvedValueOnce(response([result('New category', 'accessibility')]))
    vi.stubGlobal('fetch', fetcher)
    const rendered = render(<SiteCheckResults siteId="owned" area="search" results={[]} />)
    await screen.findByText('Earlier')
    const more = screen.getByRole('button', { name: 'Load more recorded results' })
    more.focus(); fireEvent.click(more)
    await waitFor(() => expect(signal).toBeDefined())
    expect(signal.aborted).toBe(false)
    rendered.rerender(<SiteCheckResults siteId="owned" area="accessibility" results={[]} />)
    expect(signal.aborted).toBe(true)
    expect(await screen.findByText('New category')).toBeVisible()
    expect(document.body).toHaveFocus()
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

  it('moves keyboard focus to the first added result when the final continuation disappears', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([result('Added first'), result('Added second')])))
    render(<SiteCheckResults siteId="owned" results={[result('Recorded')]} nextCursor="more" />)
    const more = screen.getByRole('button', { name: 'Load more recorded results' })
    more.focus()
    fireEvent.click(more)
    const added = await screen.findByText('Added first')
    await waitFor(() => expect(added.closest('li')).toHaveFocus())
    expect(screen.queryByRole('button', { name: 'Load more recorded results' })).toBeNull()
  })

  it('keeps focus on retry after failure and then focuses the fresh evidence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response([result('Recovered read')])))
    render(<SiteCheckResults siteId="owned" area="search" results={[result('Recorded')]} />)
    const retry = await screen.findByRole('button', { name: 'Try loading results again' })
    retry.focus()
    fireEvent.click(retry)
    await waitFor(() => expect(retry).toBeEnabled())
    expect(retry).toHaveFocus()
    fireEvent.click(retry)
    const added = await screen.findByText('Recovered read')
    await waitFor(() => expect(added.closest('li')).toHaveFocus())
  })

  it('keeps an intentional focus move while the continuation is loading', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve })))
    render(<><button>Monitoring controls</button><SiteCheckResults siteId="owned" results={[result('Recorded')]} nextCursor="more" /></>)
    const more = screen.getByRole('button', { name: 'Load more recorded results' })
    more.focus(); fireEvent.click(more)
    const outside = screen.getByRole('button', { name: 'Monitoring controls' })
    outside.focus()
    await act(async () => { finish(response([result('Added result')])) })
    expect(outside).toHaveFocus()
  })

  it('focuses the newly revealed Search evidence when its local show-more button disappears', () => {
    render(<SearchResults results={Array.from({ length: 12 }, (_, index) => searchResult(index + 1))} />)
    expect(screen.queryByText('Search item 11')).toBeNull()
    const more = screen.getByRole('button', { name: 'Show more results' })
    more.focus(); fireEvent.click(more)
    expect(screen.getByText('Search item 11').closest('li')).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Show more results' })).toBeNull()
  })

  it('keeps empty final-page completion reachable after removing its continuation button', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([])))
    render(<SiteCheckResults siteId="owned" results={[result('Recorded')]} nextCursor="more" />)
    const more = screen.getByRole('button', { name: 'Load more recorded results' })
    more.focus(); fireEvent.click(more)
    await screen.findByText('All available results in this scope are shown.')
    expect(screen.getByRole('region', { name: 'Recorded checks' })).toHaveFocus()
  })

  it('continues through the Search disclosure when a loaded final page is still collapsed', async () => {
    const results = Array.from({ length: 10 }, (_, index) => searchResult(index + 1))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([searchResult(11), searchResult(12)])))
    render(<SiteCheckResults siteId="owned" results={results} nextCursor="more" />)
    const more = screen.getByRole('button', { name: 'Load more recorded results' })
    more.focus(); fireEvent.click(more)
    const show = await screen.findByRole('button', { name: 'Show more results' })
    expect(show).toHaveFocus()
    expect(screen.queryByText('Search item 11')).toBeNull()
    fireEvent.click(show)
    expect(screen.getByText('Search item 11').closest('li')).toHaveFocus()
  })
})
