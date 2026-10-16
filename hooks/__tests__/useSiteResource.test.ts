import { createElement } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, expect, it, vi } from 'vitest'
import { useSiteResource } from '../useSiteResource'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'

it('keeps updating after analysis finishes until the independent result arrives, then stops polling', async () => {
  const pending = siteViewFixture()
  const finished = { ...pending, outcomes: [{ ...pending.outcomes[0], running: false, lastVerifiedAt: '2026-10-10T15:00:00Z' }] }
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => pending }).mockResolvedValue({ ok: true, json: async () => finished })
  vi.stubGlobal('fetch', fetch)
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0, isVisible: () => true, isOnline: () => true } }, children)
  const { result, unmount } = renderHook(() => useSiteResource('fixture-site', pending), { wrapper })
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  expect(result.current.view.outcomes[0].running).toBe(true)
  await waitFor(() => expect(result.current.view.outcomes[0].lastVerifiedAt).toBe('2026-10-10T15:00:00Z'), { timeout: 5000 })
  const calls = fetch.mock.calls.length
  await new Promise(resolve => setTimeout(resolve, 2800))
  expect(fetch).toHaveBeenCalledTimes(calls)
  unmount()
})
it('retains the recorded view when a successful HTTP response has malformed state', async () => {
  const initial = siteViewFixture()
  initial.outcomes = []
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ audit: { status: 'COMPLETED' }, outcomes: 'broken' }) }))
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig, { value: { provider: () => new Map(), shouldRetryOnError: false } }, children)
  const { result, unmount } = renderHook(() => useSiteResource('fixture-site', initial), { wrapper })
  await waitFor(() => expect(result.current.disconnected).toBe(true))
  expect(result.current.view).toEqual(initial)
  unmount()
})
afterEach(() => { vi.unstubAllGlobals() })

it('keeps a captured refresh bound to its original Site after navigation', async () => {
  const first = siteViewFixture(); first.outcomes = []
  const next = structuredClone(first)
  next.site.siteId = 'next-site'; next.site.projectId = 'next-site'; next.presentation.identity.siteId = 'next-site'
  let failNext = false
  const fetch = vi.fn(async (url: string) => url.endsWith('/next-site') && failNext
    ? Response.json({ error: 'Read unavailable' }, { status: 503 }) : Response.json(url.endsWith('/next-site') ? next : first))
  vi.stubGlobal('fetch', fetch)
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig,
    { value: { provider: () => new Map(), shouldRetryOnError: false } }, children)
  const { result, rerender, unmount } = renderHook(({ siteId, initial }) => useSiteResource(siteId, initial),
    { wrapper, initialProps: { siteId: first.site.siteId, initial: first } })
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  const refreshFirst = result.current.refresh
  rerender({ siteId: next.site.siteId, initial: next })
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  expect(result.current.view.site.siteId).toBe(next.site.siteId)
  await act(async () => { await refreshFirst() })
  expect(result.current.view.site.siteId).toBe(next.site.siteId)
  failNext = true
  await act(async () => { await expect(result.current.refresh()).rejects.toThrow() })
  expect(result.current.disconnected).toBe(true)
  await act(async () => { await refreshFirst() })
  expect(result.current.view.site.siteId).toBe(next.site.siteId)
  expect(result.current.disconnected).toBe(true)
  unmount()
})

it('retains newest validated facts when an older request later fails', async () => {
  const initial = siteViewFixture(); initial.outcomes = []
  const current = { ...initial, inventoryPageCount: 12 }
  let release!: (response: Response) => void
  const older = new Promise<Response>(resolve => { release = resolve })
  const fetch = vi.fn().mockReturnValueOnce(older).mockResolvedValue(Response.json(current))
  vi.stubGlobal('fetch', fetch)
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig,
    { value: { provider: () => new Map(), shouldRetryOnError: false } }, children)
  const { result, unmount } = renderHook(() => useSiteResource(initial.site.siteId, initial), { wrapper })
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  await act(async () => { await result.current.refresh() })
  expect(result.current.view.inventoryPageCount).toBe(12)
  expect(result.current.disconnected).toBe(false)
  await act(async () => { release(Response.json({ error: 'Earlier read failed' }, { status: 503 })) })
  expect(result.current.view.inventoryPageCount).toBe(12)
  expect(result.current.disconnected).toBe(true)
  unmount()
})

it('ignores event callbacks from a previous Site after its stream closes', async () => {
  const initial = siteViewFixture(); initial.outcomes = []
  const next = structuredClone(initial)
  next.site.siteId = 'next-site'; next.site.projectId = 'next-site'; next.presentation.identity.siteId = 'next-site'
  const streams: Array<{ listeners: Map<string, () => void>; closed: boolean }> = []
  vi.stubGlobal('EventSource', class {
    listeners = new Map<string, () => void>()
    closed = false
    constructor() { streams.push(this) }
    addEventListener(name: string, listener: () => void) { this.listeners.set(name, listener) }
    close() { this.closed = true }
  })
  const fetch = vi.fn(async (url: string) => Response.json(url.endsWith('/next-site') ? next : initial))
  vi.stubGlobal('fetch', fetch)
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig,
    { value: { provider: () => new Map(), shouldRetryOnError: false } }, children)
  const { result, rerender, unmount } = renderHook(({ siteId, initial }) => useSiteResource(siteId, initial),
    { wrapper, initialProps: { siteId: initial.site.siteId, initial } })
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  rerender({ siteId: next.site.siteId, initial: next })
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  expect(streams[0].closed).toBe(true)
  act(() => { streams[1].listeners.get('error')?.() })
  expect(result.current.disconnected).toBe(true)
  act(() => { streams[0].listeners.get('error')?.(); streams[0].listeners.get('open')?.() })
  expect(result.current.disconnected).toBe(true)
  expect(result.current.view.site.siteId).toBe(next.site.siteId)
  expect(fetch).toHaveBeenCalledTimes(2)
  unmount()
})

it('catches up after SSE reconnect while retaining dated evidence during a disconnect', async () => {
  const initial = siteViewFixture(); initial.outcomes = []
  let current = initial
  const listeners = new Map<string, () => void>()
  const close = vi.fn()
  vi.stubGlobal('EventSource', class {
    addEventListener(name: string, listener: () => void) { listeners.set(name, listener) }
    close = close
  })
  const fetch = vi.fn(async () => ({ ok: true, json: async () => current }))
  vi.stubGlobal('fetch', fetch)
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false } }, children)
  const { result, unmount } = renderHook(() => useSiteResource('fixture-site', initial), { wrapper })
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  listeners.get('error')?.()
  await waitFor(() => expect(result.current.disconnected).toBe(true))
  expect(result.current.view).toEqual(initial)
  current = { ...initial, inventoryPageCount: 12 }
  listeners.get('open')?.()
  await waitFor(() => expect(result.current.view.inventoryPageCount).toBe(12))
  expect(result.current.disconnected).toBe(false)
  listeners.get('access-expired')?.()
  await waitFor(() => expect(result.current.disconnected).toBe(true))
  expect(close).toHaveBeenCalled()
  unmount()
})

it('observes an active diagnostic run even when the broad analysis and Outcomes are idle', async () => {
  const initial = siteViewFixture(); initial.outcomes = []
  initial.activeRuns = [{ id: 'diagnostic-run', auditId: 'diagnostic-audit', scope: 'DIAGNOSTIC', targetLabel: '/cart',
    trigger: 'MANUAL', status: 'RUNNING', requestedAt: '2026-10-11T09:00:00Z', progress: 10 }]
  const finished = { ...initial, activeRuns: [] }
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => initial }).mockResolvedValue({ ok: true, json: async () => finished })
  vi.stubGlobal('fetch', fetch)
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0, isVisible: () => true, isOnline: () => true } }, children)
  const { result, unmount } = renderHook(() => useSiteResource('fixture-site', initial), { wrapper })
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(result.current.view.activeRuns).toEqual([]), { timeout: 5000 })
  expect(result.current.view.audit.id).toBe('audit-1')
  unmount()
})


it('refreshes enabled Uptime every minute after website work is idle', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  try {
    const initial = siteViewFixture(); initial.outcomes = []; initial.activeRuns = []
    initial.uptime = { enabled: true, targetUrl: initial.site.url, state: 'unknown', lastCheckedAt: null, nextCheckAt: null, openIncidentCount: 0, segments: [] }
    const fetch = vi.fn(async () => ({ ok: true, json: async () => initial }))
    vi.stubGlobal('fetch', fetch)
    const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0, isVisible: () => true, isOnline: () => true } }, children)
    const { unmount } = renderHook(() => useSiteResource('fixture-site', initial), { wrapper })
    await act(async () => { await vi.advanceTimersByTimeAsync(20) })
    expect(fetch).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(59_000) })
    expect(fetch).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(1_010) })
    expect(fetch).toHaveBeenCalledTimes(2)
    unmount()
  } finally { vi.useRealTimers() }
})
