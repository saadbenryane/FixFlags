import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SWRConfig } from 'swr'
import type { ReactNode } from 'react'
import { siteFlagFixture, siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import type { SiteHomeView } from '@/lib/sites/site-home'
import type { SiteFlagPanelData } from '@/lib/sites/flag-panel'
import type { MonitoringHistoryEntry } from '@/lib/sites/monitoring-history'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SiteFlagPanel } from '../SiteFlagPanel'

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
