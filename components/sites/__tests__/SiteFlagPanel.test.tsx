import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SWRConfig } from 'swr'
import type { ReactNode } from 'react'
import { siteFlagFixture, siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import type { SiteHomeView } from '@/lib/sites/site-home'
import type { SiteFlagPanelData } from '@/lib/sites/flag-panel'
import type { MonitoringHistoryEntry } from '@/lib/sites/monitoring-history'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SiteFlagPanel } from '../SiteFlagPanel'
import { readSiteHomeView } from '@/lib/sites/site-view-contract'
import { SITE_ACTION_COPY as A } from '@/lib/marketing/copy/site-actions'

// The refresh contract under test supplies this existing action's running state.
vi.mock('../SiteFlagActions', () => ({ SiteFlagActions: ({ verifying }: { verifying: boolean }) =>
  <button disabled={verifying}>Check recorded fix</button> }))

afterEach(() => vi.unstubAllGlobals())

function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>{children}</SWRConfig>
}
function viewFixture() {
  const view = siteViewFixture()
  view.flags = [siteFlagFixture({ id: 'incident', improvementId: 'incident', sourceFlagId: 'source-1' })]
  return view
}
function payload(overrides: Partial<SiteFlagPanelData['flag']> = {}): SiteFlagPanelData {
  return { flag: { ...siteFlagFixture({ id: 'incident', sourceFlagId: 'source-1' }),
    sourceAuditId: 'source-audit', expectedBehavior: 'Each button has an accessible name.', repairGuidance: 'ready',
    evidenceMissing: false, viewport: 'mobile', supportingObservations: [], supportingEvidenceUnreadable: false,
    performanceEvidenceSource: null, verifying: false, ...overrides }, capture: null }
}
function history(id: string, flagId = 'source-1'): MonitoringHistoryEntry {
  return { id, checkedAt: '2026-11-03T00:00:00Z', flagCount: 1, executionState: 'COMPLETED',
    flags: [{ id: flagId, title: 'Recorded button problem' }] }
}
function panel(view: SiteHomeView) {
  return <SiteFlagPanel siteId={view.site.siteId} flagId="incident" view={view} onClose={vi.fn()} restoreFocus={vi.fn()} />
}

it.each(['initial', 'retained'] as const)('shows pending %s detail recovery, retains evidence, and allows retry after another failure', async mode => {
  let finish!: (response: Response) => void
  const fetcher = vi.fn()
  if (mode === 'retained') fetcher.mockResolvedValueOnce(Response.json(payload()))
  fetcher.mockResolvedValueOnce(Response.json({}, { status: 503 }))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
    .mockResolvedValueOnce(Response.json(payload({ evidence: 'Fresh recorded observation' })))
  vi.stubGlobal('fetch', fetcher)
  const view = viewFixture()
  const rendered = render(panel(view), { wrapper })
  if (mode === 'retained') {
    await screen.findByText('Recorded unnamed button')
    rendered.rerender(panel({ ...view, flags: [{ ...view.flags[0], repairEvidenceRevision: 'b'.repeat(64) }] }))
  }
  const retry = await screen.findByRole('button', { name: A.retryResults })
  retry.focus()
  fireEvent.click(retry)
  const expectedReads = mode === 'retained' ? 3 : 2
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(expectedReads))
  expect(retry).toBeDisabled()
  expect(retry).toHaveAttribute('aria-busy', 'true')
  expect(retry).toHaveTextContent(A.loading)
  fireEvent.click(retry)
  expect(fetcher).toHaveBeenCalledTimes(expectedReads)
  if (mode === 'retained') expect(screen.getByText('Recorded unnamed button')).toBeVisible()
  await act(async () => { finish(Response.json({}, { status: 503 })) })
  expect(retry).toBeEnabled()
  expect(retry).toHaveTextContent(A.retryResults)
  fireEvent.click(retry)
  expect(await screen.findByText('Fresh recorded observation')).toBeVisible()
  expect(screen.queryByRole('button', { name: A.retryResults })).not.toBeInTheDocument()
  expect(fetcher).toHaveBeenCalledTimes(expectedReads + 1)
})

it.each(['primary', 'paths-only'] as const)('opens every affected page once in %s evidence without mixing live addresses with saved proof', async mode => {
  const first = 'https://example.com/Plans/?locale=fr#annual'
  const second = 'https://example.com/contact?source=footer'
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload({ pageUrl: mode === 'primary' ? first : null,
    affectedPaths: mode === 'primary' ? [first, second, second] : [second] }))))
  render(panel(viewFixture()), { wrapper })
  await screen.findByText('Recorded unnamed button')
  fireEvent.click(screen.getByText(C.evidenceDetails, { selector: 'summary' }))
  for (const url of mode === 'primary' ? [first, second] : [second]) {
    const links = screen.getAllByRole('link', { name: C.open(url) })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', url)
    expect(links[0]).toHaveAttribute('target', '_blank')
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer')
  }
  expect(screen.getByText('Recorded unnamed button')).toBeVisible()
})

it.each(['still_open', 'regressed', 'could_not_verify', 'missing_evidence', 'incomparable_scope'] as const)
('shows the recorded %s check before its captured evidence', async result => {
  const checkedAt = '2026-11-03T00:00:00.000Z'
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload({ verificationFeedback: { result, checkedAt } }))))
  render(panel(viewFixture()), { wrapper })
  const notice = await screen.findByText(result === 'still_open' || result === 'regressed' ? C.flagVerificationStillOpen : C.flagVerificationInconclusive, { exact: false })
  expect(notice).toBeVisible()
  expect(notice.querySelector('time')).toHaveAttribute('datetime', checkedAt)
  expect(notice.compareDocumentPosition(screen.getByText('Recorded unnamed button')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Check recorded fix' })).toBeEnabled()
})

it('does not treat an ordinary open Flag as a completed unsuccessful verification', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload())))
  render(panel(viewFixture()), { wrapper })
  expect(await screen.findByText('Recorded unnamed button')).toBeVisible()
  expect(screen.queryByText(C.flagVerificationStillOpen)).not.toBeInTheDocument()
  expect(screen.queryByText(C.flagVerificationInconclusive)).not.toBeInTheDocument()
})

it.each(['FIXED', 'VERIFIED', 'IGNORED', 'DISMISSED', 'verifying'])('hides old unsuccessful feedback for a %s Flag', async state => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload({ status: state === 'verifying' ? 'OPEN' : state,
    verifying: state === 'verifying', verificationFeedback: { result: 'still_open', checkedAt: null } }))))
  render(panel(viewFixture()), { wrapper })
  expect(await screen.findByText('Recorded unnamed button')).toBeVisible()
  expect(screen.queryByText(C.flagVerificationStillOpen)).not.toBeInTheDocument()
})

it('retires previous verification feedback immediately when a new check starts', async () => {
  const view = viewFixture()
  let finish!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(payload({ verificationFeedback: { result: 'still_open', checkedAt: null } })))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve })))
  const rendered = render(panel(view), { wrapper })
  expect(await screen.findByText(C.flagVerificationStillOpen)).toBeVisible()
  expect(document.querySelector('time')).not.toBeInTheDocument()
  rendered.rerender(panel({ ...view, flags: [{ ...view.flags[0], verificationState: 'verifying' }] }))
  expect(screen.queryByText(C.flagVerificationStillOpen)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check recorded fix' })).toBeDisabled()
  await act(async () => { finish(Response.json(payload({ verifying: true }))) })
  expect(screen.queryByText(C.flagVerificationStillOpen)).not.toBeInTheDocument()
})

it('retains the readable performance title after the detail DTO is parsed', async () => {
  const view = viewFixture()
  const finding = { checkId: 'mobile-lcp-critical', problem: 'Mobile LCP is critically slow (4.5s, target < 2.5s)' }
  view.flags = [{ ...view.flags[0], ...finding }]
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload({ ...finding, evidence: 'Loaded measurement evidence' }))))
  render(panel(view), { wrapper })
  expect(screen.getByRole('heading', { name: 'Main content takes too long to appear on phones' })).toBeVisible()
  expect(await screen.findByText('Loaded measurement evidence')).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Main content takes too long to appear on phones' })).toBeVisible()
  expect(screen.queryByRole('heading', { name: finding.problem })).not.toBeInTheDocument()
})

it('refreshes an open Flag from the newest linked check without refetching for unrelated history', async () => {
  const view = viewFixture()
  view.monitoringHistory = [history('recent-check'), history('oldest-check')]
  const fetch = vi.fn().mockResolvedValueOnce(Response.json(payload({ verifying: true })))
    .mockResolvedValueOnce(Response.json(payload({ verifying: false })))
  vi.stubGlobal('fetch', fetch)
  const rendered = render(panel(view), { wrapper })
  expect(await screen.findByRole('button', { name: 'Check recorded fix' })).toBeDisabled()
  rendered.rerender(panel({ ...view, monitoringHistory: [history('unrelated-check', 'another-flag'), ...view.monitoringHistory] }))
  expect(fetch).toHaveBeenCalledTimes(1)
  rendered.rerender(panel({ ...view, monitoringHistory: [history('newest-check'), ...view.monitoringHistory] }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Check recorded fix' })).toBeEnabled())
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('refreshes the selected incident when its representative capture changes without a status change', async () => {
  const view = viewFixture()
  const fetch = vi.fn().mockResolvedValueOnce(Response.json(payload({ status: 'FIXED', evidence: 'Original captured button has no name.' })))
    .mockResolvedValueOnce(Response.json(payload({ sourceFlagId: 'source-2', sourceAuditId: 'another-audit',
      evidence: 'Another captured button has no name.' })))
  vi.stubGlobal('fetch', fetch)
  const rendered = render(panel(view), { wrapper })
  expect(await screen.findByText('Original captured button has no name.')).toBeVisible()
  expect(screen.getByText(C.flagResolved)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Check recorded fix' })).not.toBeInTheDocument()
  rendered.rerender(panel({ ...view, flags: [{ ...view.flags[0], sourceFlagId: 'source-2' }] }))
  expect(await screen.findByText('Another captured button has no name.')).toBeVisible()
  expect(screen.queryByText('Original captured button has no name.')).not.toBeInTheDocument()
  expect(screen.queryByText(C.flagResolved)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check recorded fix' })).toBeEnabled()
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch).toHaveBeenLastCalledWith('/api/sites/fixture-site/flags/incident', expect.objectContaining({ cache: 'no-store' }))
})

it('refreshes changed repair evidence from a published Site view without changing the Flag identity or status', async () => {
  const view = viewFixture()
  view.flags[0].repairEvidenceRevision = 'a'.repeat(64)
  const publish = (next: SiteHomeView) => readSiteHomeView(JSON.parse(JSON.stringify(next)), view.site.siteId)
  let finish!: (response: Response) => void
  const fetch = vi.fn().mockResolvedValueOnce(Response.json(payload({ evidence: 'Earlier recorded observation' })))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetch)
  const rendered = render(panel(publish(view)), { wrapper })
  expect(await screen.findByText('Earlier recorded observation')).toBeVisible()
  rendered.rerender(panel(publish({ ...view, flags: [...view.flags, siteFlagFixture({ id: 'unrelated', repairEvidenceRevision: 'c'.repeat(64) })] })))
  expect(fetch).toHaveBeenCalledTimes(1)
  rendered.rerender(panel(publish({ ...view, flags: [{ ...view.flags[0], repairEvidenceRevision: 'b'.repeat(64) }] })))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  expect(screen.getByText('Earlier recorded observation')).toBeVisible()
  expect(screen.getByText(C.flagRefreshing)).toBeVisible()
  await act(async () => { finish(Response.json(payload({ evidence: 'Newly published observation' }))) })
  expect(screen.getByText('Newly published observation')).toBeVisible()
  expect(screen.queryByText('Earlier recorded observation')).not.toBeInTheDocument()
  expect(screen.queryByText(C.flagRefreshing)).not.toBeInTheDocument()
})

it('refreshes completed repair guidance in a Site view without an evidence revision', async () => {
  const view = viewFixture()
  view.flags[0].repairGuidance = 'pending'
  const fetch = vi.fn().mockResolvedValueOnce(Response.json(payload({ repairGuidance: 'pending', whyItMatters: 'Earlier explanation' })))
    .mockResolvedValueOnce(Response.json(payload({ repairGuidance: 'ready', whyItMatters: 'Published repair explanation' })))
  vi.stubGlobal('fetch', fetch)
  const rendered = render(panel(view), { wrapper })
  expect(await screen.findByText('Earlier explanation')).toBeVisible()
  rendered.rerender(panel({ ...view, flags: [{ ...view.flags[0], repairGuidance: 'ready' }] }))
  expect(await screen.findByText('Published repair explanation')).toBeVisible()
  expect(fetch).toHaveBeenCalledTimes(2)
})

it.each(['FIXED', 'VERIFIED'])('labels the observation as historical when the detail authority reports %s recovery', async status => {
  const view = viewFixture()
  view.resolvedFlags = [{ ...view.flags[0], status, verificationState: 'verified', resolvedInId: 'proof-audit' }]
  view.flags = []
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload({ status }))))
  render(panel(view), { wrapper })
  expect(await screen.findByText(C.flagResolved)).toBeVisible()
  expect(screen.getByText(C.previousObservation)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Check recorded fix' })).not.toBeInTheDocument()
})

it('uses live recovery immediately while retaining the previous evidence after a failed detail refresh', async () => {
  const view = viewFixture()
  let finish!: (response: Response) => void
  const fetch = vi.fn().mockResolvedValueOnce(Response.json(payload()))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetch)
  const rendered = render(panel(view), { wrapper })
  expect(await screen.findByRole('button', { name: 'Check recorded fix' })).toBeEnabled()

  rendered.rerender(panel({ ...view, flags: [], resolvedFlags: [{ ...view.flags[0], status: 'VERIFIED',
    verificationState: 'verified', resolvedInId: 'proof-audit' }] }))
  expect(screen.getByText(C.flagResolved)).toBeVisible()
  expect(screen.getByText(C.previousObservation)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Check recorded fix' })).not.toBeInTheDocument()
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  await act(async () => { finish(Response.json({}, { status: 503 })) })
  expect(await screen.findByText(C.flagRefreshFailed)).toBeVisible()
  expect(screen.getByText('Recorded unnamed button')).toBeVisible()
  expect(screen.getByText(C.flagResolved)).toBeVisible()
})

it('retires an old recovery message as soon as monitoring records recurrence', async () => {
  const view = viewFixture()
  const recovered = { ...view, flags: [], resolvedFlags: [{ ...view.flags[0], status: 'VERIFIED', verificationState: 'verified' as const }] }
  let finish!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(payload({ status: 'VERIFIED' })))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve })))
  const rendered = render(panel(recovered), { wrapper })
  expect(await screen.findByText(C.flagResolved)).toBeVisible()
  rendered.rerender(panel({ ...view, flags: [{ ...view.flags[0], status: 'REGRESSED', verificationState: 'regressed' }] }))
  expect(screen.queryByText(C.flagResolved)).not.toBeInTheDocument()
  expect(screen.getByText(C.flagRefreshing)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Check recorded fix' })).toBeEnabled()
  await act(async () => { finish(Response.json(payload({ status: 'REGRESSED' }))) })
  expect(screen.queryByText(C.flagRefreshing)).not.toBeInTheDocument()
})

it('follows live verification activity while the detail request is still pending', async () => {
  const view = viewFixture()
  let finish!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(payload()))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve })))
  const rendered = render(panel(view), { wrapper })
  expect(await screen.findByRole('button', { name: 'Check recorded fix' })).toBeEnabled()
  rendered.rerender(panel({ ...view, flags: [{ ...view.flags[0], verificationState: 'verifying' }] }))
  expect(screen.getByRole('button', { name: 'Check recorded fix' })).toBeDisabled()
  await act(async () => { finish(Response.json(payload({ verifying: true }))) })
  expect(screen.getByRole('button', { name: 'Check recorded fix' })).toBeDisabled()
})

it.each(['IGNORED', 'DISMISSED'])('keeps repair actions closed for a %s Flag', async status => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload({ status }))))
  render(panel(viewFixture()), { wrapper })
  expect(await screen.findByText('Recorded unnamed button')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Check recorded fix' })).not.toBeInTheDocument()
  expect(screen.queryByText(C.flagResolved)).not.toBeInTheDocument()
})
