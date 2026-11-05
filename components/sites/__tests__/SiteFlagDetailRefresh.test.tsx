import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { siteFlagFixture, siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import type { SiteHomeView } from '@/lib/sites/site-home'
import { SiteResourceBoundary, useSharedSiteResource } from '../SiteResourceBoundary'
import { SiteFlagDetailRefresh } from '../SiteFlagDetailRefresh'

const routeRefresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: routeRefresh }) }))
beforeEach(() => { routeRefresh.mockReset(); vi.stubGlobal('EventSource', undefined) })
afterEach(() => vi.unstubAllGlobals())

function fixture() {
  const view = siteViewFixture()
  view.outcomes = []
  view.flags = [siteFlagFixture({ id: 'incident', sourceFlagId: 'source-1' })]
  return view
}
function ReadSite({ siteId }: { siteId: string }) {
  const { refresh, view } = useSharedSiteResource(siteId)
  return <><button onClick={() => void refresh().catch(() => {})}>Read current Site</button><output>{view.flags[0]?.verificationState}</output></>
}
function Page({ initial, observe = true }: { initial: SiteHomeView; observe?: boolean }) {
  return <SiteResourceBoundary siteId={initial.site.siteId} initial={initial}>
    {observe ? <SiteFlagDetailRefresh siteId={initial.site.siteId} flagId="incident" sourceFlagId="source-1" initial={initial} /> : null}
    <input aria-label="Publication note" /><ReadSite siteId={initial.site.siteId} />
  </SiteResourceBoundary>
}
function show(initial: SiteHomeView, observe = true) {
  const provider = () => new Map()
  return render(<Page initial={initial} observe={observe} />, { wrapper: ({ children }) => <SWRConfig value={{ provider, dedupingInterval: 0, shouldRetryOnError: false }}>{children}</SWRConfig> })
}
function check(id: string, flagId: string) {
  return { id, checkedAt: '2026-11-03T12:00:00Z', evidenceAt: '2026-11-03T12:00:00Z', flagCount: 1,
    status: 'COMPLETED' as const, executionState: 'COMPLETED' as const, completionState: 'COMPLETED' as const,
    scope: 'SITE' as const, targetLabel: null, afterFix: false, trigger: 'MANUAL' as const, result: 'FLAG' as const, flags: [{ id: flagId, title: 'Recorded problem' }] }
}

it('refreshes server proof on another session’s verification and recovery through the existing Site read', async () => {
  const initial = fixture()
  let current = initial
  const fetch = vi.fn(async () => Response.json(current))
  vi.stubGlobal('fetch', fetch)
  show(initial)
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  expect(routeRefresh).not.toHaveBeenCalled()
  const note = screen.getByRole('textbox', { name: 'Publication note' })
  fireEvent.change(note, { target: { value: 'Keep this publication context' } })
  current = { ...initial, flags: [{ ...initial.flags[0], verificationState: 'verifying' }] }
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(routeRefresh).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  expect(routeRefresh).toHaveBeenCalledTimes(1)
  current = { ...initial, flags: [], resolvedFlags: [{ ...initial.flags[0], status: 'VERIFIED', verificationState: 'verified', resolvedInId: 'proof-check' }] }
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(routeRefresh).toHaveBeenCalledTimes(2))
  expect(fetch).toHaveBeenCalledTimes(4)
  expect(note).toHaveValue('Keep this publication context')
})

it('continues observing recurrence on a recovered page without repair controls', async () => {
  const initial = fixture()
  initial.resolvedFlags = [{ ...initial.flags[0], status: 'VERIFIED', verificationState: 'verified', resolvedInId: 'proof-check' }]
  initial.flags = []
  let current = initial
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(current)))
  show(initial)
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  current = { ...initial, resolvedFlags: [], flags: [{ ...initial.resolvedFlags[0], sourceFlagId: 'source-2', status: 'REGRESSED', verificationState: 'regressed', resolvedInId: null }] }
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(routeRefresh).toHaveBeenCalledOnce())
})

it('ignores unrelated work and acknowledges a refreshed server baseline without another request', async () => {
  const initial = fixture()
  let current = initial
  const fetch = vi.fn(async () => Response.json(current))
  vi.stubGlobal('fetch', fetch)
  const page = show(initial)
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  current = { ...initial, monitoringHistory: [check('unrelated-check', 'another-source')],
    activeRuns: [{ id: 'another-run', auditId: 'another-audit', scope: 'CATEGORY', targetLabel: 'Search', trigger: 'MANUAL', status: 'RUNNING', requestedAt: '2026-11-03T12:00:00Z', progress: 25 }] }
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  expect(routeRefresh).not.toHaveBeenCalled()
  current = { ...initial, monitoringHistory: [check('linked-check', 'source-1')] }
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(routeRefresh).toHaveBeenCalledOnce())
  page.rerender(<Page initial={current} />)
  expect(routeRefresh).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4))
  expect(routeRefresh).toHaveBeenCalledOnce()
})

it('catches up when the shared Site is already newer than the rendered Flag page', async () => {
  const initial = fixture()
  let current = initial
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(current)))
  const page = show(initial, false)
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  current = { ...initial, flags: [{ ...initial.flags[0], verificationState: 'verifying' }] }
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByText('verifying')).toBeVisible()
  page.rerender(<Page initial={initial} />)
  await waitFor(() => expect(routeRefresh).toHaveBeenCalledOnce())
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('waits for an available source read before requesting refreshed proof', async () => {
  const initial = fixture()
  let current = initial
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(current)))
  show(initial)
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  current = { ...initial, recoveryUnavailable: true, flags: [{ ...initial.flags[0], verificationState: 'verifying' }] }
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByText('verifying')).toBeVisible()
  expect(routeRefresh).not.toHaveBeenCalled()
  current = { ...current, recoveryUnavailable: false }
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(routeRefresh).toHaveBeenCalledOnce())
})
