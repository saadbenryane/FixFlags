import { createElement } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, expect, it, vi } from 'vitest'
import { siteViewerActions } from '@/lib/sites/viewer-actions'
import { useSiteResource } from '../useSiteResource'
import { siteFlagFixture, siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import { categoryExecutionRecovery } from '@/lib/sites/execution-recovery'

it('delivers validated source notices to the current observer without replacing the Site stream', async () => {
  const initial = siteViewFixture(); initial.outcomes = []
  const streams: Array<{ listeners: Map<string, (event?: Event) => void>; closed: boolean }> = []
  vi.stubGlobal('EventSource', class {
    listeners = new Map<string, (event?: Event) => void>(); closed = false
    constructor() { streams.push(this) }
    addEventListener(name: string, listener: (event?: Event) => void) { this.listeners.set(name, listener) }
    close() { this.closed = true }
  })
  const fetch = vi.fn(async () => Response.json(initial))
  vi.stubGlobal('fetch', fetch)
  const first = vi.fn(), next = vi.fn()
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig,
    { value: { provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false } }, children)
  const { rerender, unmount } = renderHook(({ observer }) => useSiteResource(initial.site.siteId, initial, observer),
    { wrapper, initialProps: { observer: first } })
  try {
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    const notice = { version: 1, auditId: 'original-audit', kind: 'prescription', state: 'COMPLETED', taskId: 'task-one', observationReference: null }
    act(() => streams[0].listeners.get('projection')?.(new MessageEvent('projection', { data: JSON.stringify(notice) })))
    expect(first).toHaveBeenCalledWith({ type: 'projection', notice })
    for (const data of ['not-json', JSON.stringify({ ...notice, version: 2 }), JSON.stringify({ ...notice, secret: 'PRIVATE' })])
      act(() => streams[0].listeners.get('projection')?.(new MessageEvent('projection', { data })))
    expect(first).toHaveBeenCalledTimes(1)
    rerender({ observer: next })
    expect(streams).toHaveLength(1)
    act(() => streams[0].listeners.get('projection')?.(new MessageEvent('projection', { data: JSON.stringify(notice) })))
    expect(next).toHaveBeenCalledWith({ type: 'projection', notice })
    await act(async () => { streams[0].listeners.get('open')?.() })
    await waitFor(() => expect(next).toHaveBeenCalledWith({ type: 'reconnected' }))
    await act(async () => { streams[0].listeners.get('access-expired')?.() })
    expect(streams[0].closed).toBe(true)
    act(() => streams[0].listeners.get('projection')?.(new MessageEvent('projection', { data: JSON.stringify(notice) })))
    expect(next).toHaveBeenCalledTimes(2)
    unmount()
    act(() => streams[0].listeners.get('projection')?.(new MessageEvent('projection', { data: JSON.stringify(notice) })))
    expect(first).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledTimes(2)
  } finally { unmount() }
})

it('keeps pending guidance updating after analysis completion and stops frequent polling when it settles', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  try {
    const initial = siteViewFixture(); initial.outcomes = []
    initial.flags = [siteFlagFixture({ repairGuidance: 'pending' })]
    const ready = { ...initial, flags: [siteFlagFixture({ repairGuidance: 'ready', fix: 'Restore the label.' })] }
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(initial)).mockImplementation(async () => Response.json(ready))
    vi.stubGlobal('fetch', fetch)
    const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig, { value: {
      provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false, isVisible: () => true, isOnline: () => true,
    } }, children)
    const { result, unmount } = renderHook(() => useSiteResource(initial.site.siteId, initial), { wrapper })
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(50) })
      expect(fetch).toHaveBeenCalledTimes(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(2700) })
      expect(result.current.view.flags[0].repairGuidance).toBe('ready')
      const settledReads = fetch.mock.calls.length
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
      expect(fetch).toHaveBeenCalledTimes(settledReads)
    } finally { unmount() }
  } finally { vi.useRealTimers() }
})

it('accepts a successful refresh with the actual sparse recovery map and keeps updates available', async () => {
  const initial = siteViewFixture(); initial.outcomes = []
  const updated = { ...initial, inventoryPageCount: initial.inventoryPageCount + 1,
    executionProgress: { total: 0, completed: 0, running: 0, pending: 0, recovering: 0, unknown: 0, inapplicable: 0,
      recoveryUntil: null, eventCursor: null, tasks: [], categoryRecovery: categoryExecutionRecovery([]) } }
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(updated)))
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig,
    { value: { provider: () => new Map(), shouldRetryOnError: false } }, children)
  const { result, unmount } = renderHook(() => useSiteResource('fixture-site', initial), { wrapper })
  try {
    await waitFor(() => expect(result.current.view.inventoryPageCount).toBe(updated.inventoryPageCount))
    expect(result.current.view.executionProgress?.categoryRecovery).toEqual({})
    expect(result.current.disconnected).toBe(false)
  } finally { unmount() }
})

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

it('retires a captured refresh after navigation without affecting the current Site', async () => {
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
  await act(async () => { await expect(refreshFirst()).rejects.toThrow() })
  expect(result.current.view.site.siteId).toBe(next.site.siteId)
  failNext = true
  await act(async () => { await expect(result.current.refresh()).rejects.toThrow() })
  expect(result.current.disconnected).toBe(true)
  await act(async () => { await expect(refreshFirst()).rejects.toThrow() })
  expect(result.current.view.site.siteId).toBe(next.site.siteId)
  expect(result.current.disconnected).toBe(true)
  unmount()
})

it('retains newest validated facts and connection state when an older request later fails', async () => {
  const initial = siteViewFixture(); initial.outcomes = []; initial.audit.status = 'CHECKING'
  let current = { ...initial, inventoryPageCount: 12 }
  let release!: (response: Response) => void
  const older = new Promise<Response>(resolve => { release = resolve })
  const fetch = vi.fn().mockReturnValueOnce(older).mockImplementation(async () => Response.json(current))
  vi.stubGlobal('fetch', fetch)
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig,
    { value: { provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0, isVisible: () => true, isOnline: () => true } }, children)
  const { result, unmount } = renderHook(() => useSiteResource(initial.site.siteId, initial), { wrapper })
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  await act(async () => { await result.current.refresh() })
  expect(result.current.view.inventoryPageCount).toBe(12)
  expect(result.current.disconnected).toBe(false)
  await act(async () => { release(Response.json({ error: 'Earlier read failed' }, { status: 503 })) })
  expect(result.current.view.inventoryPageCount).toBe(12)
  expect(result.current.disconnected).toBe(false)
  current = { ...current, audit: { ...current.audit, status: 'COMPLETED' } }
  await waitFor(() => expect(result.current.view.audit.status).toBe('COMPLETED'), { timeout: 5000 })
  unmount()
})

it('does not replace a failed current refresh with a superseded successful read', async () => {
  const initial = siteViewFixture(); initial.outcomes = []
  let release!: (response: Response) => void
  const older = new Promise<Response>(resolve => { release = resolve })
  const fetch = vi.fn().mockReturnValueOnce(older).mockResolvedValue(Response.json({ error: 'Current read failed' }, { status: 503 }))
  vi.stubGlobal('fetch', fetch)
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig,
    { value: { provider: () => new Map(), shouldRetryOnError: false } }, children)
  const { result, unmount } = renderHook(() => useSiteResource(initial.site.siteId, initial), { wrapper })
  try {
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    await act(async () => { await expect(result.current.refresh()).rejects.toThrow() })
    await act(async () => { release(Response.json({ ...initial, inventoryPageCount: 12 })) })
    expect(result.current.view.inventoryPageCount).toBe(initial.inventoryPageCount)
    expect(result.current.disconnected).toBe(true)
  } finally { unmount() }
})

it('keeps a stalled initial read from blocking recovery to a completed result', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  try {
    const initial = siteViewFixture(); initial.outcomes = []; initial.audit.status = 'CHECKING'
    const finished = structuredClone(initial); finished.audit.status = 'COMPLETED'; finished.inventoryPageCount = 3
    let signal: AbortSignal | undefined
    const fetch = vi.fn().mockImplementationOnce((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      signal = options.signal ?? undefined
      signal?.addEventListener('abort', () => reject(new DOMException('Read timed out', 'AbortError')), { once: true })
    })).mockResolvedValue(Response.json(finished))
    vi.stubGlobal('fetch', fetch)
    const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig, { value: {
      provider: () => new Map(), dedupingInterval: 0, errorRetryInterval: 100, isVisible: () => true, isOnline: () => true,
    } }, children)
    const { result, unmount } = renderHook(() => useSiteResource('fixture-site', initial), { wrapper })
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(20) })
      expect(fetch).toHaveBeenCalledTimes(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
      expect(signal?.aborted).toBe(true)
      expect(result.current.disconnected).toBe(true)
      expect(result.current.view.audit.status).toBe('CHECKING')
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      expect(result.current.view.audit.status).toBe('COMPLETED')
      expect(result.current.view.inventoryPageCount).toBe(3)
      expect(result.current.disconnected).toBe(false)
    } finally { unmount() }
  } finally { vi.useRealTimers() }
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

it('never reuses cached owner instructions when the same Site is rendered for a nonowner', async () => {
  const owner = siteViewFixture(); owner.outcomes = []; owner.flags = [siteFlagFixture({ fix: 'Owner-only instructions', repairGuidance: 'ready' })]
  const visitor = structuredClone(owner)
  visitor.actions = siteViewerActions(false)
  visitor.flags[0].fix = ''; visitor.flags[0].repairGuidance = 'unavailable'
  let current = { ...owner, inventoryPageCount: 1 }
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(current)))
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig, { value: { provider: () => new Map(), shouldRetryOnError: false } }, children)
  const { result, rerender, unmount } = renderHook(({ initial }) => useSiteResource(owner.site.siteId, initial), { wrapper, initialProps: { initial: owner } })
  await waitFor(() => expect(result.current.view.inventoryPageCount).toBe(1))
  current = visitor
  rerender({ initial: visitor })
  expect(result.current.view.flags[0].fix).toBe('')
  expect(result.current.view.actions.ownership).toBe('provisional')
  unmount()
})

it('does not let a pending visitor read adopt owner instructions across a claim', async () => {
  const owner = siteViewFixture(); owner.outcomes = []
  owner.flags = [siteFlagFixture({ fix: 'Private owner repair task', repairGuidance: 'ready' })]
  const visitor = structuredClone(owner)
  visitor.actions = siteViewerActions(false)
  visitor.flags[0].fix = ''; visitor.flags[0].repairGuidance = 'unavailable'
  const reads: Array<(response: Response) => void> = []
  const fetch = vi.fn(() => new Promise<Response>(resolve => { reads.push(resolve) }))
  vi.stubGlobal('fetch', fetch)
  const cache = new Map()
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig,
    { value: { provider: () => cache, shouldRetryOnError: false } }, children)
  const { result, rerender, unmount } = renderHook(({ initial }) => useSiteResource(owner.site.siteId, initial),
    { wrapper, initialProps: { initial: visitor } })
  try {
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    rerender({ initial: owner })
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    await act(async () => { reads[1](Response.json(owner)) })
    expect(result.current.view.flags[0].fix).toBe('Private owner repair task')
    await act(async () => { reads[0](Response.json(visitor)) })
    rerender({ initial: visitor })
    expect(result.current.view.flags[0].fix).toBe('')
    expect(result.current.view.actions.ownership).toBe('provisional')
  } finally {
    unmount()
    for (const resolve of reads) resolve(Response.json(visitor))
  }
})

it('refuses to cache an owner response under a visitor scope when the session changes', async () => {
  const owner = siteViewFixture(); owner.outcomes = []
  owner.flags = [siteFlagFixture({ fix: 'Private owner repair task', repairGuidance: 'ready' })]
  const visitor = structuredClone(owner)
  visitor.actions = siteViewerActions(false)
  visitor.flags[0].fix = ''; visitor.flags[0].repairGuidance = 'unavailable'
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(owner)))
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(SWRConfig,
    { value: { provider: () => new Map(), shouldRetryOnError: false } }, children)
  const { result, rerender, unmount } = renderHook(({ initial }) => useSiteResource(owner.site.siteId, initial),
    { wrapper, initialProps: { initial: visitor } })
  try {
    await waitFor(() => expect(result.current.disconnected).toBe(true))
    expect(result.current.view.flags[0].fix).toBe('')
    rerender({ initial: owner })
    await waitFor(() => expect(result.current.disconnected).toBe(false))
    expect(result.current.view.flags[0].fix).toBe('Private owner repair task')
  } finally { unmount() }
})
