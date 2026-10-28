import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, expect, it, vi } from 'vitest'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import { siteViewerActions } from '@/lib/sites/viewer-actions'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
import { SiteResourceBoundary } from '../SiteResourceBoundary'
import { SiteOutcomeActions } from '../SiteOutcomeActions'

const routeRefresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: routeRefresh }) }))
afterEach(() => { vi.unstubAllGlobals(); routeRefresh.mockClear() })

function viewFixture() {
  const view = siteViewFixture()
  view.outcomes[0] = { ...view.outcomes[0], running: false, latestRunId: null,
    bindings: [{ key: 'availability', required: true, scope: null, mechanism: 'HTTP_AVAILABILITY', version: 1 }] }
  return view
}
function show(initial: ReturnType<typeof viewFixture>) {
  return render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
    <SiteResourceBoundary siteId={initial.site.siteId} initial={initial}>
      <SiteOutcomeActions siteId={initial.site.siteId} initial={initial.outcomes[0]} />
    </SiteResourceBoundary>
  </SWRConfig>)
}

it('observes verification admission and completion through one shared Site stream', async () => {
  const initial = viewFixture()
  let current = initial
  const streams: Array<Map<string, (event?: Event) => void>> = []
  vi.stubGlobal('EventSource', class {
    listeners = new Map<string, (event?: Event) => void>()
    constructor() { streams.push(this.listeners) }
    addEventListener(name: string, listener: (event?: Event) => void) { this.listeners.set(name, listener) }
    close() {}
  })
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith('/verify')) {
      current = structuredClone(initial)
      current.outcomes[0].running = true; current.outcomes[0].latestRunId = 'run-2'
      current.activeRuns = [{ id: 'run-2', auditId: 'audit-2', scope: 'OUTCOMES', targetLabel: 'Availability',
        trigger: 'MANUAL', status: 'RUNNING', requestedAt: '2026-10-27T11:00:00Z', progress: 10 }]
      return Response.json({ runId: 'run-2', auditId: 'audit-2', outcomeIds: [initial.outcomes[0].id], reused: false }, { status: 202 })
    }
    return Response.json(current)
  })
  vi.stubGlobal('fetch', fetch)
  const rendered = show(initial)
  try {
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: C.outcome.verify }))
    await waitFor(() => expect(screen.getByRole('button', { name: C.outcome.verifying })).toBeDisabled())
    await waitFor(() => expect(routeRefresh).toHaveBeenCalledTimes(1))
    current = structuredClone(current); current.activeRuns[0].progress = 75
    const beforeProgress = fetch.mock.calls.length
    act(() => { streams[0].get('projection')?.(new Event('projection')) })
    await waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThan(beforeProgress))
    expect(routeRefresh).toHaveBeenCalledTimes(1)
    current = structuredClone(current)
    current.activeRuns = []
    current.outcomes[0].running = false; current.outcomes[0].state = 'CLEAR'
    current.outcomes[0].lastVerifiedAt = '2026-10-27T12:00:00Z'
    act(() => { streams[0].get('projection')?.(new Event('projection')) })
    await waitFor(() => expect(screen.getByRole('button', { name: C.outcome.verify })).toBeEnabled())
    expect(routeRefresh).toHaveBeenCalledTimes(2)
    expect(streams).toHaveLength(1)
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/verify'))).toHaveLength(1)
  } finally { rendered.unmount() }
})

it('observes completion by polling when event streaming is unavailable', async () => {
  const initial = viewFixture(); initial.outcomes[0].running = true
  const complete = structuredClone(initial); complete.outcomes[0].running = false
  vi.stubGlobal('EventSource', undefined)
  const fetch = vi.fn().mockResolvedValueOnce(Response.json(initial)).mockImplementation(async () => Response.json(complete))
  vi.stubGlobal('fetch', fetch)
  const rendered = show(initial)
  try {
    expect(screen.getByRole('button', { name: C.outcome.verifying })).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('button', { name: C.outcome.verify })).toBeEnabled(), { timeout: 5000 })
    expect(routeRefresh).toHaveBeenCalledTimes(1)
  } finally { rendered.unmount() }
})

it('continues visitors through authentication instead of submitting a refused verification', async () => {
  const initial = viewFixture(); initial.actions = siteViewerActions(false)
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(initial)))
  const rendered = show(initial)
  try {
    const link = screen.getByRole('link', { name: C.outcome.verify })
    expect(link).toHaveAttribute('href', '/sign-in?next=' + encodeURIComponent(`/sites/${initial.site.siteId}/outcomes/${initial.outcomes[0].id}`))
    expect(screen.queryByRole('button', { name: C.outcome.verify })).not.toBeInTheDocument()
  } finally { rendered.unmount() }
})

it('keeps a failed refresh from claiming a current verification result', async () => {
  const initial = viewFixture()
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status: 503 })))
  const rendered = show(initial)
  try {
    await waitFor(() => expect(screen.getByRole('button', { name: C.outcome.verify })).toBeDisabled())
    expect(routeRefresh).not.toHaveBeenCalled()
  } finally { rendered.unmount() }
})
