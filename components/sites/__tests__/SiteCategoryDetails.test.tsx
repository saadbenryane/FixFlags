import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SiteCategoryDetails } from '../SiteCategoryDetails'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import type { BoardCardView } from '@/lib/sites/board-card'
import type { SiteCheckResult } from '@/lib/sites/check-results'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SITE_ACTION_COPY as A } from '@/lib/marketing/copy/site-actions'
import { SITE_BOARD_COPY as B } from '@/lib/marketing/copy/terminology'

function card(id: BoardCardView['id'] = 'security'): BoardCardView {
  return { id, name: id, question: 'Recorded check', state: 'unknown', status: 'Not verified', answer: 'Not verified',
    detail: null, facts: [], coverage: null, evidenced: false, openFlagCount: 0, checkedAt: null, flagIds: [], flagChips: [],
    sources: ['Recorded browser evidence'], activity: null, wide: false, captureUrl: '/api/screenshots/security',
    captureAlt: 'Recorded security capture', cropUrl: null, cropAlt: null, problem: null }
}
function result(name: string): SiteCheckResult {
  return { id: name, name, area: 'security', auditId: 'audit', kind: 'assertion', status: 'observed',
    pageUrl: 'https://example.com/', checkedAt: '2026-11-03T00:00:00Z', historical: false, limitation: 'Recorded scope',
    source: 'rendered-dom', evidenceReference: { auditId: 'audit', executionId: `execution-${name}`, pageUrl: 'https://example.com/' } }
}
function panel(selected = card(), siteId = 'fixture-site') {
  return <SiteCategoryDetails selected={selected} siteId={siteId} view={siteViewFixture()} selectedFlags={[]}
    selectedRecommendations={[]} confirmedOutcomes={[]} findingPages={0} busy={false}
    checkAction={() => <button>Retry this category</button>} verifyOutcome={async () => {}} onClose={() => {}} restoreFocus={() => {}} />
}
afterEach(() => vi.unstubAllGlobals())

it('defers optional evidence and its capture until disclosure, then retains loaded pages across collapse', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ results: [result('First security evidence')], nextCursor: 'more' }))
    .mockResolvedValueOnce(Response.json({ results: [result('Next security evidence')], nextCursor: null }))
  vi.stubGlobal('fetch', fetcher)
  render(panel())
  expect(screen.getByRole('heading', { name: 'security' })).toBeVisible()
  expect(fetcher).not.toHaveBeenCalled()
  expect(screen.queryByRole('img', { name: 'Recorded security capture', hidden: true })).not.toBeInTheDocument()
  const summary = screen.getByText(C.checkDetails, { selector: 'summary' })
  const details = summary.closest('details')!
  fireEvent.click(summary)
  expect(await screen.findByText('First security evidence')).toBeVisible()
  expect(screen.getByRole('img', { name: 'Recorded security capture' })).toHaveAttribute('src', '/api/screenshots/security')
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(new URL(fetcher.mock.calls[0][0], 'https://fixflags.com').searchParams.get('area')).toBe('security')
  fireEvent.click(screen.getByRole('button', { name: A.moreResults }))
  expect(await screen.findByText('Next security evidence')).toBeVisible()
  fireEvent.click(summary)
  await waitFor(() => expect(details.open).toBe(false))
  expect(screen.getByText('Next security evidence')).not.toBeVisible()
  fireEvent.click(summary)
  await waitFor(() => expect(screen.getByText('Next security evidence')).toBeVisible())
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it.each(['category', 'site'])('opens a fresh disclosure for a different %s without an unsolicited read', async scope => {
  const fetcher = vi.fn(async () => Response.json({ results: [result('Original evidence')], nextCursor: null }))
  vi.stubGlobal('fetch', fetcher)
  const rendered = render(panel())
  fireEvent.click(screen.getByText(C.checkDetails, { selector: 'summary' }))
  await screen.findByText('Original evidence')
  rendered.rerender(scope === 'category' ? panel(card('search')) : panel(card(), 'another-site'))
  expect(screen.getByText(C.checkDetails, { selector: 'summary' }).closest('details')!.open).toBe(false)
  expect(screen.queryByText('Original evidence')).not.toBeInTheDocument()
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('keeps the primary recovery action available without requiring an evidence read', () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  render(panel({ ...card(), incompleteReason: 'The recorded check could not finish' }))
  expect(screen.getByText(/The recorded check could not finish/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Retry this category' })).toBeVisible()
  expect(fetcher).not.toHaveBeenCalled()
})

it('explains missing evidence immediately instead of substituting an empty Flag count', () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  render(panel({ ...card(), answer: B.notCheckedYet, detail: 'No public evidence for this area yet' }))
  expect(screen.getByText(B.notCheckedYet)).toBeVisible()
  expect(screen.getByText('No public evidence for this area yet')).toBeVisible()
  expect(screen.queryByText(C.noFlags)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retry this category' })).toBeVisible()
  expect(fetcher).not.toHaveBeenCalled()
})

it('gives stale evidence one visible explanation and one recheck action across disclosure', async () => {
  const fetcher = vi.fn(async () => Response.json({ results: [], nextCursor: null }))
  vi.stubGlobal('fetch', fetcher)
  render(panel({ ...card(), evidenced: true, answer: B.checkOutOfDate, status: B.checkOutOfDate,
    checkedAt: '2026-09-01T00:00:00Z', detail: B.checkOutOfDateDetail, coverage: B.checkOutOfDateDetail,
    facts: [B.checkOutOfDateDetail] }))
  expect(screen.getByText(B.checkOutOfDate)).toBeVisible()
  expect(screen.getByText(B.checkOutOfDateDetail)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Retry this category' })).toBeVisible()
  expect(fetcher).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText(C.checkDetails, { selector: 'summary' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  expect(screen.getAllByText(B.checkOutOfDateDetail)).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: 'Retry this category' })).toHaveLength(1)
  expect(document.querySelector('time[datetime="2026-09-01T00:00:00Z"]')).toBeVisible()
})

it('keeps a completed healthy conclusion quiet and its optional recheck behind disclosure', () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  render(panel({ ...card(), state: 'healthy', evidenced: true, answer: 'No unsafe browser behavior observed', checkedAt: '2026-11-03T00:00:00Z' }))
  expect(screen.getByText('No unsafe browser behavior observed')).toBeVisible()
  expect(screen.queryByText(C.noFlags)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Retry this category' })).not.toBeInTheDocument()
  expect(fetcher).not.toHaveBeenCalled()
})

it('keeps an incomplete explanation in its existing recovery location', async () => {
  const fetcher = vi.fn(async () => Response.json({ results: [], nextCursor: null }))
  vi.stubGlobal('fetch', fetcher)
  render(panel({ ...card(), answer: B.cardCheckIncomplete, incompleteReason: B.cardCheckIncomplete }))
  expect(screen.queryByText(C.noFlags)).not.toBeInTheDocument()
  expect(screen.getByText(new RegExp(B.cardCheckIncomplete))).toBeVisible()
  fireEvent.click(screen.getByText(C.checkDetails, { selector: 'summary' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  expect(screen.getAllByRole('button', { name: 'Retry this category' })).toHaveLength(1)
})
