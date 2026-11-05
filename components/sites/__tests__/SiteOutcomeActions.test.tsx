import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, expect, it, vi } from 'vitest'
import { siteFlagFixture, siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import { siteViewerActions } from '@/lib/sites/viewer-actions'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'
import { SiteResourceBoundary, useSharedSiteResource } from '../SiteResourceBoundary'
import { SiteOutcomeActions } from '../SiteOutcomeActions'
import { OUTCOME_CONFIRMATION as N } from '@/lib/marketing/copy/errors'

const routeRefresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: routeRefresh }) }))
afterEach(() => { vi.unstubAllGlobals(); routeRefresh.mockClear() })

function viewFixture() {
  const view = siteViewFixture()
  view.outcomes[0] = { ...view.outcomes[0], running: false, latestRunId: null,
    bindings: [{ key: 'availability', required: true, scope: null, mechanism: 'HTTP_AVAILABILITY', version: 1 }] }
  return view
}
function ReadSite({ siteId }: { siteId: string }) {
  const { refresh } = useSharedSiteResource(siteId)
  return <button onClick={() => void refresh().catch(() => {})}>Read current Site</button>
}
function OutcomePageFixture({ initial, outcome = initial.outcomes[0] }: { initial: ReturnType<typeof viewFixture>; outcome?: ReturnType<typeof viewFixture>['outcomes'][number] }) {
  return <SiteResourceBoundary siteId={initial.site.siteId} initial={initial}>
    <SiteOutcomeActions siteId={initial.site.siteId} initial={outcome} initialView={initial} />
    <ReadSite siteId={initial.site.siteId} />
  </SiteResourceBoundary>
}
function show(initial: ReturnType<typeof viewFixture>, outcome = initial.outcomes[0]) {
  const provider = () => new Map()
  return render(<OutcomePageFixture initial={initial} outcome={outcome} />, { wrapper: ({ children }) =>
    <SWRConfig value={{ provider, dedupingInterval: 0, shouldRetryOnError: false }}>{children}</SWRConfig> })
}

it('retains accepted verification through a failed refresh until a source covering the Outcome catches up', async () => {
  const initial = viewFixture(); initial.readAt = 1000
  const outcome = initial.outcomes[0]
  let current = initial, admitted = false, readFailed = true
  vi.stubGlobal('EventSource', undefined)
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/verify')) {
      admitted = true
      return Response.json({ runId: 'accepted-run', auditId: 'accepted-audit', outcomeIds: [outcome.id], reused: false }, { status: 202 })
    }
    if (admitted && readFailed) throw new Error('Source read unavailable')
    return Response.json(current)
  })
  vi.stubGlobal('fetch', fetcher)
  show(initial)
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByRole('button', { name: C.outcome.verify }))
  expect(await screen.findByText(C.refreshPending)).toBeVisible()
  expect(screen.getByRole('button', { name: C.outcome.verifying })).toBeDisabled()

  readFailed = false
  current = { ...initial, readAt: 2000, outcomes: [] }
  fireEvent.click(screen.getByRole('button', { name: 'Read current Site' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4))
  expect(screen.getByRole('button', { name: C.outcome.verifying })).toBeDisabled()

  current = { ...initial, readAt: 3000, outcomes: [{ ...outcome, latestRunId: 'accepted-run', running: false, state: 'CLEAR' }] }
  fireEvent.click(screen.getByRole('button', { name: 'Read current Site' }))
  await waitFor(() => expect(screen.getByRole('button', { name: C.outcome.verify })).toBeEnabled())
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/verify'))).toHaveLength(1)
})

it('retains an accepted active check when the Outcome is paused before the source catches up', async () => {
  const initial = viewFixture(); initial.readAt = 1000; initial.outcomes[0].enabled = false
  let changed = false
  vi.stubGlobal('EventSource', undefined)
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === 'PATCH') {
      changed = true
      const { enabled } = JSON.parse(String(options.body))
      return Response.json({ outcome: { id: initial.outcomes[0].id, enabled }, verificationQueued: enabled, verificationError: null })
    }
    if (changed) throw new Error('Source read unavailable')
    return Response.json(initial)
  }))
  show(initial)
  fireEvent.click(screen.getByRole('button', { name: 'Enable Outcome' }))
  const pause = await screen.findByRole('button', { name: 'Pause Outcome' })
  await waitFor(() => expect(pause).toBeEnabled())
  expect(screen.getByRole('button', { name: C.outcome.verifying })).toBeDisabled()
  fireEvent.click(pause)
  const enable = await screen.findByRole('button', { name: 'Enable Outcome' })
  await waitFor(() => expect(enable).toBeEnabled())
  expect(screen.getByText(C.refreshPending)).toBeVisible()
  expect(screen.getByRole('button', { name: C.outcome.verifying })).toBeDisabled()
})

it.each(['delayed', 'failed'] as const)('keeps accepted pause and enable controls consistent while the source read is %s', async mode => {
  const initial = viewFixture()
  initial.readAt = 1000
  let current = initial
  let readFailed = mode === 'failed'
  const changes: boolean[] = []
  vi.stubGlobal('EventSource', undefined)
  vi.stubGlobal('fetch', vi.fn(async (_url: RequestInfo | URL, options?: RequestInit) => {
    if (options?.method === 'PATCH') {
      const { enabled } = JSON.parse(String(options.body))
      changes.push(enabled)
      return Response.json({ outcome: { id: initial.outcomes[0].id, enabled }, verificationQueued: enabled, verificationError: null })
    }
    if (changes.length && readFailed) return Response.json({ message: 'Read unavailable' }, { status: 503 })
    return Response.json(current)
  }))
  show(initial)
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByRole('button', { name: 'Pause Outcome' }))
  const enable = await screen.findByRole('button', { name: 'Enable Outcome' })
  await waitFor(() => expect(enable).toBeEnabled())
  expect(screen.getByRole('button', { name: C.outcome.verify })).toBeDisabled()
  if (mode === 'failed') expect(screen.getByText(C.refreshPending)).toBeVisible()

  fireEvent.click(enable)
  const pause = await screen.findByRole('button', { name: 'Pause Outcome' })
  await waitFor(() => expect(pause).toBeEnabled())
  expect(screen.getByRole('button', { name: C.outcome.verifying })).toBeDisabled()
  expect(changes).toEqual([false, true])

  readFailed = false
  current = { ...initial, readAt: 2000 }
  fireEvent.click(screen.getByRole('button', { name: 'Read current Site' }))
  await waitFor(() => expect(screen.getByRole('button', { name: C.outcome.verify })).toBeEnabled())
  current = { ...initial, readAt: 3000, outcomes: [{ ...initial.outcomes[0], enabled: false }] }
  fireEvent.click(screen.getByRole('button', { name: 'Read current Site' }))
  expect(await screen.findByRole('button', { name: 'Enable Outcome' })).toBeEnabled()
  current = { ...initial, readAt: 4000 }
  fireEvent.click(screen.getByRole('button', { name: 'Read current Site' }))
  expect(await screen.findByRole('button', { name: 'Pause Outcome' })).toBeEnabled()
  expect(screen.getByRole('button', { name: C.outcome.verify })).toBeEnabled()
  expect(changes).toEqual([false, true])
})

it('keeps an accepted pause on retained detail until a source covering that Outcome catches up', async () => {
  const initial = viewFixture()
  initial.readAt = 1000
  const outcome = initial.outcomes[0]
  initial.outcomes = []
  let saved = false
  vi.stubGlobal('EventSource', undefined)
  vi.stubGlobal('fetch', vi.fn(async (_url: RequestInfo | URL, options?: RequestInit) => {
    if (options?.method === 'PATCH') {
      saved = true
      return Response.json({ outcome: { id: outcome.id, enabled: false }, verificationQueued: false, verificationError: null })
    }
    return Response.json({ ...initial, readAt: saved ? 2000 : 1000 })
  }))
  const rendered = show(initial, outcome)
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByRole('button', { name: 'Pause Outcome' }))
  await screen.findByText(C.outcome.paused)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Enable Outcome' })).toBeEnabled())
  expect(screen.getByRole('button', { name: C.outcome.verify })).toBeDisabled()

  rendered.rerender(<OutcomePageFixture initial={{ ...initial, readAt: 3000 }} outcome={{ ...outcome, enabled: false }} />)
  expect(screen.getByRole('button', { name: 'Enable Outcome' })).toBeEnabled()
  rendered.rerender(<OutcomePageFixture initial={{ ...initial, readAt: 4000 }} outcome={outcome} />)
  expect(screen.getByRole('button', { name: 'Pause Outcome' })).toBeEnabled()
  expect(screen.getByRole('button', { name: C.outcome.verify })).toBeEnabled()
})

it('catches up when an already cached Outcome is newer than the rendered evidence', async () => {
  const initial = viewFixture(), current = structuredClone(initial)
  current.outcomes[0].state = 'CLEAR'; current.outcomes[0].lastVerifiedAt = '2026-11-03T12:00:00Z'
  vi.stubGlobal('EventSource', undefined)
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(current)))
  const provider = () => new Map()
  function Page({ observe }: { observe: boolean }) {
    return <SiteResourceBoundary siteId={initial.site.siteId} initial={initial}>
      <ReadCurrent />
      {observe ? <SiteOutcomeActions siteId={initial.site.siteId} initial={initial.outcomes[0]} initialView={initial} /> : null}
    </SiteResourceBoundary>
  }
  function ReadCurrent() {
    const { view } = useSharedSiteResource(initial.site.siteId)
    return <output>{view.outcomes[0].state}</output>
  }
  const page = render(<Page observe={false} />, { wrapper: ({ children }) => <SWRConfig value={{ provider, shouldRetryOnError: false }}>{children}</SWRConfig> })
  expect(await screen.findByText('CLEAR')).toBeVisible()
  page.rerender(<Page observe />)
  await waitFor(() => expect(routeRefresh).toHaveBeenCalledOnce())
})

it('keeps newer rendered verification activity from being downgraded by the accompanying older summary', async () => {
  const initial = viewFixture(); initial.readAt = 1000
  const outcome = { ...initial.outcomes[0], running: true, latestRunId: 'selected-run' }
  const completed = structuredClone(initial); completed.readAt = 2000
  completed.outcomes[0] = { ...outcome, running: false, state: 'CLEAR', lastVerifiedAt: '2026-11-03T12:00:00Z' }
  let finish!: (response: Response) => void
  vi.stubGlobal('EventSource', undefined)
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve })))
  show(initial, outcome)
  expect(screen.getByRole('button', { name: C.outcome.verifying })).toBeDisabled()
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
  await act(async () => { finish(Response.json(completed)) })
  await waitFor(() => expect(screen.getByRole('button', { name: C.outcome.verify })).toBeEnabled())
  expect(routeRefresh).toHaveBeenCalledOnce()
})

it('ignores unrelated Site runs when the selected Outcome has not changed', async () => {
  const initial = viewFixture(), current = structuredClone(initial)
  current.activeRuns = [{ id: 'other-run', auditId: 'other-audit', scope: 'CATEGORY', targetLabel: 'Search', trigger: 'MANUAL',
    status: 'RUNNING', requestedAt: '2026-11-03T12:00:00Z', progress: 10 }]
  vi.stubGlobal('EventSource', undefined)
  const fetcher = vi.fn(async () => Response.json(current))
  vi.stubGlobal('fetch', fetcher)
  show(initial)
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  expect(routeRefresh).not.toHaveBeenCalled()
})

it('refreshes changed related Flags once and acknowledges the returned server baseline', async () => {
  const initial = viewFixture()
  initial.outcomes[0].flagId = 'related'
  initial.flags = [siteFlagFixture({ id: 'related' })]
  let current = initial
  vi.stubGlobal('EventSource', undefined)
  const fetcher = vi.fn(async () => Response.json(current))
  vi.stubGlobal('fetch', fetcher)
  const page = show(initial)
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  current = { ...initial, flags: [], resolvedFlags: [{ ...initial.flags[0], status: 'FIXED' }] }
  fireEvent.click(screen.getByRole('button', { name: 'Read current Site' }))
  await waitFor(() => expect(routeRefresh).toHaveBeenCalledOnce())
  page.rerender(<OutcomePageFixture initial={current} />)
  fireEvent.click(screen.getByRole('button', { name: 'Read current Site' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3))
  expect(routeRefresh).toHaveBeenCalledOnce()
})

it('waits for a usable source before refreshing changed Outcome evidence', async () => {
  const initial = viewFixture()
  let current = initial
  vi.stubGlobal('EventSource', undefined)
  const fetcher = vi.fn(async () => Response.json(current))
  vi.stubGlobal('fetch', fetcher)
  show(initial)
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  current = structuredClone(initial); current.recoveryUnavailable = true; current.outcomes[0].state = 'CLEAR'
  fireEvent.click(screen.getByRole('button', { name: 'Read current Site' }))
  await waitFor(() => expect(screen.getByRole('button', { name: C.outcome.verify })).toBeDisabled())
  expect(routeRefresh).not.toHaveBeenCalled()
  current = { ...current, recoveryUnavailable: false }
  fireEvent.click(screen.getByRole('button', { name: 'Read current Site' }))
  await waitFor(() => expect(routeRefresh).toHaveBeenCalledOnce())
})

it('observes a changed recurrence even while an older resolved occurrence shares its identity', async () => {
  const initial = viewFixture()
  initial.outcomes[0].flagId = 'incident'
  initial.flags = [siteFlagFixture({ id: 'incident', status: 'REGRESSED' })]
  initial.resolvedFlags = [siteFlagFixture({ id: 'incident', status: 'VERIFIED' })]
  const current = structuredClone(initial)
  current.flags[0].problem = 'A new recurrence observation'
  vi.stubGlobal('EventSource', undefined)
  const fetcher = vi.fn(async () => Response.json(current))
  vi.stubGlobal('fetch', fetcher)
  show(initial)
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  await waitFor(() => expect(routeRefresh).toHaveBeenCalledOnce())
})

it('retains run observation for historical Outcomes omitted from the current summary', async () => {
  const initial = viewFixture(), outcome = initial.outcomes[0]
  initial.outcomes = []
  const current = structuredClone(initial)
  current.activeRuns = [{ id: 'retained-run', auditId: 'retained-audit', scope: 'OUTCOMES', targetLabel: outcome.name, trigger: 'MANUAL',
    status: 'RUNNING', requestedAt: '2026-11-03T12:00:00Z', progress: 10 }]
  vi.stubGlobal('EventSource', undefined)
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(current)))
  show(initial, outcome)
  await waitFor(() => expect(routeRefresh).toHaveBeenCalledOnce())
})

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
    act(() => streams[0].get('error')?.())
    expect(screen.getByRole('button', { name: C.outcome.verify })).toBeEnabled()
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
    expect(screen.queryByRole('button', { name: N.edit })).not.toBeInTheDocument()
  } finally { rendered.unmount() }
})

it('lets the owner correct the Outcome name and refreshes the server-rendered detail through the shared Site read', async () => {
  const initial = viewFixture(); initial.readAt = 1
  let current = initial
  vi.stubGlobal('EventSource', undefined)
  const fetch = vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === 'POST') {
      const change = JSON.parse(options.body as string)
      current = structuredClone(initial); current.readAt = 2
      current.outcomes[0].name = change.name
      current.outcomes[0].inferenceSource = 'user'
      return Response.json({ ok: true, outcome: current.outcomes[0] })
    }
    return Response.json(current)
  })
  vi.stubGlobal('fetch', fetch)
  const rendered = show(initial)
  try {
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: N.edit }))
    fireEvent.change(screen.getByRole('textbox', { name: N.nameLabel }), { target: { value: 'Pricing page loads' } })
    fireEvent.click(screen.getByRole('button', { name: N.save }))
    expect(await screen.findByText(N.renamed)).toBeVisible()
    await waitFor(() => expect(routeRefresh).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledWith(`/api/sites/${initial.site.siteId}/outcomes`, expect.objectContaining({ method: 'POST',
      body: JSON.stringify({ action: 'rename', outcomeId: initial.outcomes[0].id, name: 'Pricing page loads' }) }))
    fireEvent.click(screen.getByRole('button', { name: N.edit }))
    expect(screen.getByRole('textbox', { name: N.nameLabel })).toHaveValue('Pricing page loads')
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
