import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, expect, it, vi } from 'vitest'
import { LiveSiteAnalysisDetails } from '@/components/layout/AnalysisDetails'
import { SiteFlagActions } from '../SiteFlagActions'
import { SiteResourceBoundary, useSharedSiteResource } from '../SiteResourceBoundary'
import type { SiteResourceUpdate } from '@/hooks/useSiteResource'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
afterEach(() => vi.unstubAllGlobals())

function consumerStreamFixture() {
  const streams: Array<{ listeners: Map<string, (event?: Event) => void>; closed: boolean }> = []
  vi.stubGlobal('EventSource', class {
    listeners = new Map<string, (event?: Event) => void>(); closed = false
    constructor() { streams.push(this) }
    addEventListener(name: string, listener: (event?: Event) => void) { this.listeners.set(name, listener) }
    close() { this.closed = true }
  })
  return streams
}

function Consumer({ siteId, name, onUpdate }: { siteId: string; name: string; onUpdate?: (update: SiteResourceUpdate) => void }) {
  const { view, disconnected, refresh } = useSharedSiteResource(siteId, onUpdate)
  return <div data-testid={name}>{view.site.siteId}:{view.inventoryPageCount}:{String(disconnected)}
    <button onClick={() => { void refresh().catch(() => {}) }}>{name}</button>
  </div>
}

it('shares one live subscription between the analysis sidebar and Flag actions', async () => {
  const initial = siteViewFixture(); initial.outcomes = []
  const streams = consumerStreamFixture()
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(initial)))
  const rendered = render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
    <SiteResourceBoundary siteId={initial.site.siteId} initial={initial}>
      <LiveSiteAnalysisDetails siteId={initial.site.siteId} />
      <SiteFlagActions siteId={initial.site.siteId} initial={initial} flagId="historical-flag" repairGuidance="pending" />
    </SiteResourceBoundary>
  </SWRConfig>)
  try {
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(streams).toHaveLength(1)
    act(() => streams[0].listeners.get('error')?.())
    expect(screen.getAllByText(/Updates disconnected/).length).toBeGreaterThan(0)
  } finally { rendered.unmount() }
  expect(streams.every(stream => stream.closed)).toBe(true)
})

it('shares validated refreshes and failures, keeps siblings connected, and catches up once on reconnect', async () => {
  const initial = siteViewFixture(); initial.outcomes = []
  const streams = consumerStreamFixture()
  let current = initial, fail = false
  const fetch = vi.fn(async () => fail ? Response.json({}, { status: 503 }) : Response.json(current))
  vi.stubGlobal('fetch', fetch)
  const cache = new Map()
  const first = vi.fn(), second = vi.fn()
  const page = (showFirst: boolean) => <SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}>
    <SiteResourceBoundary siteId={initial.site.siteId} initial={initial}>
      {showFirst ? <Consumer siteId={initial.site.siteId} name="first" onUpdate={first} /> : null}
      <SiteResourceBoundary siteId={initial.site.siteId} initial={initial}>
        <Consumer siteId={initial.site.siteId} name="second" onUpdate={second} />
      </SiteResourceBoundary>
    </SiteResourceBoundary>
  </SWRConfig>
  const rendered = render(page(true))
  try {
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    fail = true
    fireEvent.click(screen.getByRole('button', { name: 'second' }))
    await waitFor(() => expect(screen.getByTestId('first')).toHaveTextContent(':true'))
    expect(screen.getByTestId('second')).toHaveTextContent(':true')
    current = { ...initial, inventoryPageCount: 12 }; fail = false
    fireEvent.click(screen.getByRole('button', { name: 'first' }))
    await waitFor(() => expect(screen.getByTestId('second')).toHaveTextContent(':12:false'))
    expect(screen.getByTestId('first')).toHaveTextContent(':12:false')
    expect(fetch).toHaveBeenCalledTimes(3)
    rendered.rerender(page(false))
    expect(streams).toHaveLength(1); expect(streams[0].closed).toBe(false)
    current = { ...initial, inventoryPageCount: 15 }
    await act(async () => { streams[0].listeners.get('open')?.() })
    await waitFor(() => expect(screen.getByTestId('second')).toHaveTextContent(':15:false'))
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(second).toHaveBeenCalledWith({ type: 'reconnected' })
    expect(first).not.toHaveBeenCalled()
  } finally { rendered.unmount() }
  expect(streams[0].closed).toBe(true)
})

it('fences navigation and observer replacement without opening a second connection for child boundaries', async () => {
  const initial = siteViewFixture(); initial.outcomes = []
  const next = structuredClone(initial)
  next.site.siteId = 'next-site'; next.site.projectId = 'next-site'; next.presentation.identity.siteId = 'next-site'
  const streams = consumerStreamFixture()
  const fetch = vi.fn(async (url: string) => Response.json(url.endsWith('/next-site') ? next : initial))
  vi.stubGlobal('fetch', fetch)
  const cache = new Map(), before = vi.fn(), after = vi.fn()
  const page = (view: typeof initial, observer: typeof before) => <SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}>
    <SiteResourceBoundary siteId={view.site.siteId} initial={view}>
      <Consumer siteId={view.site.siteId} name="current" onUpdate={observer} />
    </SiteResourceBoundary>
  </SWRConfig>
  const rendered = render(page(initial, before))
  try {
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    rendered.rerender(page(initial, after))
    const notice = { version: 1, auditId: 'source', kind: 'prescription', state: 'COMPLETED', taskId: 'task', observationReference: null }
    act(() => streams[0].listeners.get('projection')?.(new MessageEvent('projection', { data: JSON.stringify(notice) })))
    expect(before).not.toHaveBeenCalled()
    expect(after).toHaveBeenCalledTimes(1)
    expect(streams).toHaveLength(1)
    rendered.rerender(page(next, after))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(streams).toHaveLength(2); expect(streams[0].closed).toBe(true)
    act(() => {
      streams[0].listeners.get('projection')?.(new MessageEvent('projection', { data: JSON.stringify(notice) }))
      streams[0].listeners.get('open')?.(); streams[0].listeners.get('error')?.()
    })
    expect(after).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('current')).toHaveTextContent('next-site:')
    expect(screen.getByTestId('current')).toHaveTextContent(':false')
    expect(fetch).toHaveBeenCalledTimes(2)
    await act(async () => { streams[1].listeners.get('access-expired')?.() })
    expect(screen.getByTestId('current')).toHaveTextContent(':true')
    expect(streams[1].closed).toBe(true)
    act(() => streams[1].listeners.get('projection')?.(new MessageEvent('projection', { data: JSON.stringify(notice) })))
    expect(after).toHaveBeenCalledTimes(1)
  } finally { rendered.unmount() }
})
