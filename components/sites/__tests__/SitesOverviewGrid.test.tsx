import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SitesOverviewGrid } from '../SitesOverviewGrid'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import type { SiteSummary } from '@/lib/sites/application/list-sites'
import { resultPresentation } from '@/lib/sites/presentation'
import { sitePresentationSchema } from '@/lib/sites/presentation-contract'

function site(): SiteSummary {
  return { id: 'example', name: 'Example', hostname: 'example.com',
    presentation: siteViewFixture().presentation, lastUsefulChangeAt: '2026-10-21T10:00:00Z' }
}

describe('Websites overview', () => {
  it('ages retained rows locally without reclassifying their results and accepts a newer check timestamp', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-03T12:00:00Z'))
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const first = site(), second = { ...site(), id: 'second', hostname: 'second.example.com' }
    first.presentation.freshness = { checkedAt: '2026-11-03T12:00:00Z', label: 'Just now', stale: false }
    second.presentation.freshness = { checkedAt: '2026-11-03T11:58:00Z', label: '2 min ago', stale: false }
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const page = render(<SitesOverviewGrid sites={[first, second]} />)
    try {
      const [firstRow, secondRow] = screen.getAllByRole('link')
      await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
      expect(within(firstRow).getByText('2 min ago')).toBeVisible()
      expect(within(secondRow).getByText('4 min ago')).toBeVisible()
      expect(within(firstRow).getByText('Not verified').closest('dd')).toHaveAttribute('data-tone', 'pending')
      expect(firstRow.querySelector('time')).toHaveAttribute('datetime', '2026-11-03T12:00:00Z')
      expect(firstRow.querySelector('time')).toHaveAttribute('title', 'Nov 3, 2026, 12:00 PM UTC')
      expect(vi.getTimerCount()).toBe(1)
      first.presentation.freshness = { checkedAt: '2026-11-03T12:02:00Z', label: 'Just now', stale: false }
      page.rerender(<SitesOverviewGrid sites={[first, second]} />)
      expect(within(firstRow).getByText('Just now')).toBeVisible()
      expect(firstRow.querySelector('time')).toHaveAttribute('datetime', '2026-11-03T12:02:00Z')
      expect(fetch).not.toHaveBeenCalled()
    } finally { cleanup(); visibility.mockRestore(); vi.unstubAllGlobals(); vi.useRealTimers() }
  })

  it.each(['offline', 'unknown'] as const)('keeps %s uptime attention visible when recorded Flags also exist', observedState => {
    const website = site()
    website.presentation.result = resultPresentation({ auditStatus: 'COMPLETED', healthState: 'problem', flagCount: 3,
      stale: false, hasCurrentEvidence: true, uptime: { state: 'FLAG', observedState, validUntil: null } })
    website.presentation.flags = { count: 3, label: '3 Flags', fixFirstCount: 0 }
    website.presentation = sitePresentationSchema.parse(website.presentation)
    render(<SitesOverviewGrid sites={[website]} />)
    const row = screen.getByRole('link')
    const label = observedState === 'offline' ? 'Offline' : 'Needs attention'
    expect(within(row).getByText(label).closest('dd')).toHaveAttribute('data-tone', 'attention')
    expect(within(row).queryByText('3 Flags')).not.toBeInTheDocument()
    expect(website.presentation.flags.count).toBe(3)
  })

  it('keeps a Site readable and openable when its capture fails, then accepts a new source', () => {
    const website = site()
    website.presentation.identity.preview = { url: '/api/screenshots/old-capture', pageUrl: 'https://example.com/', viewport: '1280 × 900', recordedAt: '2026-10-21T10:00:00Z' }
    const view = render(<SitesOverviewGrid sites={[website]} />)
    const row = screen.getByRole('link'), image = row.querySelector('img')!
    expect(image).toHaveAttribute('src', '/api/screenshots/old-capture')
    fireEvent.error(image)
    expect(row.querySelector('img')).toBeNull()
    expect(row).toHaveAttribute('href', '/sites/example')
    expect(within(row).getByText('example.com')).toBeVisible()
    expect(within(row).getByText('Not verified')).toBeVisible()
    website.presentation.identity.preview = { ...website.presentation.identity.preview, url: '/api/screenshots/new-capture' }
    view.rerender(<SitesOverviewGrid sites={[website]} />)
    expect(row.querySelector('img')).toHaveAttribute('src', '/api/screenshots/new-capture')
  })

  it('does not let an earlier image failure hide another Site or a newer capture', () => {
    const first = site(), second = { ...site(), id: 'another', hostname: 'another.example.com' }
    first.presentation.identity.preview = { url: '/api/screenshots/first', pageUrl: 'https://example.com/', viewport: '1280 × 900', recordedAt: '2026-10-21T10:00:00Z' }
    second.presentation.identity.preview = { url: '/api/screenshots/second', pageUrl: 'https://another.example.com/', viewport: '1280 × 900', recordedAt: '2026-10-21T10:00:00Z' }
    const view = render(<SitesOverviewGrid sites={[first, second]} />)
    const [firstRow, secondRow] = screen.getAllByRole('link')
    const retired = firstRow.querySelector('img')!
    first.presentation.identity.preview = { ...first.presentation.identity.preview, url: '/api/screenshots/replacement' }
    view.rerender(<SitesOverviewGrid sites={[first, second]} />)
    fireEvent.error(retired)
    expect(firstRow.querySelector('img')).toHaveAttribute('src', '/api/screenshots/replacement')
    fireEvent.error(firstRow.querySelector('img')!)
    expect(firstRow.querySelector('img')).toBeNull()
    expect(secondRow.querySelector('img')).toHaveAttribute('src', '/api/screenshots/second')
  })

  it('keeps monitoring, result, coverage, and freshness distinct and renders each once', () => {
    const website = site()
    website.presentation.freshness.label = 'Checked just now'
    render(<SitesOverviewGrid sites={[website]} />)
    const row = screen.getByRole('link')
    expect(row).toHaveAttribute('href', '/sites/example')
    expect(within(row).getAllByText('Not monitored')).toHaveLength(1)
    expect(within(row).getAllByText('Not verified')).toHaveLength(1)
    expect(within(row).getAllByText('1 page')).toHaveLength(1)
    expect(within(row).getAllByText('Checked just now')).toHaveLength(1)
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('does not show zero Flags as clear when the result is unverified', () => {
    const website = site()
    website.presentation.freshness.label = 'No completed check'
    render(<SitesOverviewGrid sites={[website]} />)
    expect(screen.getByText('Not verified').closest('dd')).toHaveAttribute('data-tone', 'pending')
    expect(screen.queryByText('0 Flags')).not.toBeInTheDocument()
  })

  it('keeps known Flags visible while a new check runs', () => {
    const website = site()
    website.presentation.result = { state: 'checking', label: 'Checking' }
    website.presentation.flags = { count: 2, label: '2 Flags', fixFirstCount: 1 }
    render(<SitesOverviewGrid sites={[website]} />)
    expect(screen.getByText('2 Flags').closest('dd')).toHaveAttribute('data-tone', 'attention')
    expect(screen.queryByText('0 Flags')).not.toBeInTheDocument()
  })

  it('does not add a second empty state before a customer has a website', () => {
    const { container } = render(<SitesOverviewGrid sites={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
