import { createElement } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useSiteSummaries, type SiteSummariesSnapshot } from './useSiteSummaries'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import { SITE_SUMMARY_OWNER_HEADER, SITE_SUMMARY_READ_AT_HEADER } from '@/lib/sites/summary-contract'

let visible = true
function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0,
    isVisible: () => visible, isOnline: () => true, onErrorRetry: () => {} } }, children)
}
function snapshot(ownerId = 'owner-a', checking = true): SiteSummariesSnapshot {
  const presentation = siteViewFixture().presentation
  presentation.identity.siteId = ownerId + '-site'
  presentation.run.state = checking ? 'running' : 'idle'
  return { ownerId, readAt: Date.now(), sites: [{ id: presentation.identity.siteId, name: ownerId, hostname: ownerId + '.example',
    presentation, lastUsefulChangeAt: '2026-11-03T00:00:00Z' }] }
}
function reply(value: SiteSummariesSnapshot) {
  return Response.json(value.sites, { headers: { [SITE_SUMMARY_OWNER_HEADER]: value.ownerId, [SITE_SUMMARY_READ_AT_HEADER]: String(value.readAt) } })
}
beforeEach(() => { vi.useFakeTimers(); visible = true })
afterEach(async () => { cleanup(); await act(async () => { await vi.advanceTimersByTimeAsync(0) }); vi.unstubAllGlobals(); vi.useRealTimers() })

it('uses one batched refresh during checking, becomes quiet after completion, and pauses hidden polling', async () => {
  const initial = snapshot()
  const complete = snapshot('owner-a', false)
  const fetch = vi.fn(async () => reply(complete))
  vi.stubGlobal('fetch', fetch)
  const { result } = renderHook(() => useSiteSummaries('owner-a', initial), { wrapper })
  expect(fetch).not.toHaveBeenCalled()
  visible = false
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
  expect(fetch).not.toHaveBeenCalled()
  visible = true
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(result.current.sites?.[0].presentation.run.state).toBe('idle')
  await act(async () => { await vi.advanceTimersByTimeAsync(59_000) })
  expect(fetch).toHaveBeenCalledTimes(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('retains the last known rows after malformed data and replaces them only after a validated retry', async () => {
  const initial = snapshot()
  const current = snapshot('owner-a', false)
  const fetch = vi.fn().mockResolvedValueOnce(Response.json([{ ...current.sites[0], id: 'another-site' }],
    { headers: { [SITE_SUMMARY_OWNER_HEADER]: 'owner-a', [SITE_SUMMARY_READ_AT_HEADER]: String(current.readAt) } })).mockImplementation(async () => reply(current))
  vi.stubGlobal('fetch', fetch)
  const { result } = renderHook(() => useSiteSummaries('owner-a', initial), { wrapper })
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(result.current.failed).toBe(true)
  expect(result.current.sites).toEqual(initial.sites)
  await act(async () => { await result.current.refresh() })
  expect(result.current.failed).toBe(false)
  expect(result.current.sites?.[0].presentation.run.state).toBe('idle')
})

it('retires old account requests and cannot publish their late data into the next account', async () => {
  const initial = { ...snapshot(), readAt: 0 }, next = snapshot('owner-b', false)
  const reads: Array<{ signal: AbortSignal; finish: (response: Response) => void }> = []
  vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise<Response>(finish => reads.push({ signal: options.signal, finish }))))
  const { result, rerender } = renderHook(({ ownerId }) => useSiteSummaries(ownerId, initial),
    { wrapper, initialProps: { ownerId: 'owner-a' } })
  await act(async () => { await vi.advanceTimersByTimeAsync(20) })
  expect(reads).toHaveLength(1)
  rerender({ ownerId: 'owner-b' })
  expect(result.current.sites).toBeNull()
  expect(reads[0].signal.aborted).toBe(true)
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(reads).toHaveLength(2)
  await act(async () => { reads[1].finish(reply(next)); reads[0].finish(reply(initial)); await vi.advanceTimersByTimeAsync(0) })
  expect(result.current.sites?.[0].id).toBe('owner-b-site')
})

it('withholds rows when the server reports a different account or an expired session', async () => {
  const initial = snapshot()
  const fetch = vi.fn().mockResolvedValueOnce(reply(snapshot('owner-b'))).mockResolvedValueOnce(Response.json({}, { status: 401 }))
  vi.stubGlobal('fetch', fetch)
  const { result } = renderHook(() => useSiteSummaries('owner-a', initial), { wrapper })
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(result.current.accountChanged).toBe(true)
  expect(result.current.sites).toBeNull()
  await act(async () => { await result.current.refresh() })
  expect(result.current.authRequired).toBe(true)
  expect(result.current.sites).toBeNull()
})

it('prefers a newer server snapshot over an older account cache without an immediate duplicate read', async () => {
  const initial = { ...snapshot(), readAt: 0 }, cache = new Map()
  const cached = snapshot()
  const fetch = vi.fn(async () => reply(cached))
  vi.stubGlobal('fetch', fetch)
  const shared = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig,
    { value: { provider: () => cache, dedupingInterval: 0, isVisible: () => true, isOnline: () => true } }, children)
  const first = renderHook(() => useSiteSummaries('owner-a', initial), { wrapper: shared })
  await act(async () => { await vi.advanceTimersByTimeAsync(20) })
  expect(fetch).toHaveBeenCalledTimes(1)
  first.unmount()
  const fresh = snapshot('owner-a', false)
  const second = renderHook(() => useSiteSummaries('owner-a', fresh), { wrapper: shared })
  expect(second.result.current.sites?.[0].presentation.run.state).toBe('idle')
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('recovers a cached failure on re-entry so ordinary polling can resume', async () => {
  const cache = new Map(), initial = { ...snapshot(), readAt: 0 }
  const shared = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig,
    { value: { provider: () => cache, dedupingInterval: 0, isVisible: () => true, isOnline: () => true, onErrorRetry: () => {} } }, children)
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 503 }))
    .mockImplementation(async () => reply({ ...snapshot('owner-a', false), readAt: Date.now() }))
  vi.stubGlobal('fetch', fetch)
  const first = renderHook(() => useSiteSummaries('owner-a', initial), { wrapper: shared })
  await act(async () => { await vi.advanceTimersByTimeAsync(20) })
  expect(first.result.current.failed).toBe(true)
  first.unmount()
  const fresh = snapshot('owner-a', false)
  const second = renderHook(() => useSiteSummaries('owner-a', fresh), { wrapper: shared })
  await act(async () => { await vi.advanceTimersByTimeAsync(20) })
  expect(second.result.current.failed).toBe(false)
  expect(fetch).toHaveBeenCalledTimes(2)
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(fetch).toHaveBeenCalledTimes(3)
})

it('uses server read ordering when the browser clock is behind the server', async () => {
  const initial = { ...snapshot(), readAt: Date.now() + 60_000 }
  const current = { ...snapshot('owner-a', false), readAt: initial.readAt + 1000 }
  vi.stubGlobal('fetch', vi.fn(async () => reply(current)))
  const { result } = renderHook(() => useSiteSummaries('owner-a', initial), { wrapper })
  await act(async () => { await vi.advanceTimersByTimeAsync(20) })
  expect(result.current.sites?.[0].presentation.run.state).toBe('idle')
})

it('does not overlap slow account reads and cancels its request when the view closes', async () => {
  let signal!: AbortSignal
  const fetch = vi.fn((_url, options) => { signal = options.signal; return new Promise<Response>(() => {}) })
  vi.stubGlobal('fetch', fetch)
  const initial = snapshot()
  const view = renderHook(() => useSiteSummaries('owner-a', initial), { wrapper })
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
  expect(fetch).toHaveBeenCalledTimes(1)
  view.unmount()
  expect(signal.aborted).toBe(true)
})
