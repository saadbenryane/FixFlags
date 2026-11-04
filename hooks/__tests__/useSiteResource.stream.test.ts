import { createElement, type ReactNode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useSiteResource } from '../useSiteResource'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'

const notice = { version: 1, auditId: 'source', kind: 'prescription', state: 'COMPLETED', taskId: 'task', observationReference: null }
type Stream = { url: string; closed: boolean; listeners: Map<string, (event?: Event) => void> }
let streams: Stream[]

beforeEach(() => {
  vi.useFakeTimers()
  streams = []
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  vi.stubGlobal('EventSource', class {
    closed = false
    listeners = new Map<string, (event?: Event) => void>()
    constructor(readonly url: string) { streams.push(this) }
    addEventListener(name: string, listener: (event?: Event) => void) { this.listeners.set(name, listener) }
    close() { this.closed = true }
  })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function fixture() {
  const initial = siteViewFixture()
  initial.outcomes = []; initial.activeRuns = []; initial.audit.status = 'COMPLETED'
  const reads: Array<(view?: typeof initial, status?: number) => void> = []
  const fetcher = vi.fn(() => new Promise<Response>(resolve => {
    reads.push((view = initial, status = 200) => resolve(Response.json(view, { status })))
  }))
  vi.stubGlobal('fetch', fetcher)
  const cache = new Map(), observer = vi.fn()
  // Isolate stream admission from SWR's separately covered mount/focus polling.
  const wrapper = ({ children }: { children: ReactNode }) => createElement(SWRConfig, { value: {
    provider: () => cache, revalidateOnMount: false, revalidateOnReconnect: false,
    focusThrottleInterval: Infinity, shouldRetryOnError: false,
  } }, children)
  const hook = renderHook(() => useSiteResource(initial.site.siteId, initial, observer), { wrapper })
  return { initial, reads, fetcher, observer, ...hook }
}
async function advance(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
function emit(stream: Stream, type: string, event?: Event) {
  act(() => stream.listeners.get(type)?.(event))
}
function projection(stream = streams.at(-1)!, cursor = '') {
  emit(stream, 'projection', new MessageEvent('projection', { data: JSON.stringify(notice), lastEventId: cursor }))
}
function visible(value: DocumentVisibilityState) {
  vi.mocked(Object.getOwnPropertyDescriptor(document, 'visibilityState')!.get!).mockReturnValue(value)
  act(() => document.dispatchEvent(new Event('visibilitychange')))
}
function online(value: boolean) {
  vi.mocked(Object.getOwnPropertyDescriptor(navigator, 'onLine')!.get!).mockReturnValue(value)
  act(() => window.dispatchEvent(new Event(value ? 'online' : 'offline')))
}

it('keeps stream interruptions separate from failed reads and recovers reads without claiming stream recovery', async () => {
  const { reads, result } = fixture()
  emit(streams[0], 'error')
  expect(result.current.disconnected).toBe(true)
  expect(result.current.readUnavailable).toBe(false)
  let failed!: Promise<unknown>
  act(() => { failed = result.current.refresh().catch(error => error) })
  await advance()
  await act(async () => { reads[0](undefined, 503); await failed })
  expect(result.current.readUnavailable).toBe(true)
  let recovered!: ReturnType<typeof result.current.refresh>
  act(() => { recovered = result.current.refresh() })
  await advance()
  await act(async () => { reads[1](); await recovered })
  expect(result.current.readUnavailable).toBe(false)
  expect(result.current.disconnected).toBe(true)
})

it('holds expired access until a fresh authorized read, ignoring an older in-flight success', async () => {
  const { reads, result } = fixture()
  emit(streams[0], 'open')
  await advance()
  emit(streams[0], 'access-expired')
  expect(result.current.readUnavailable).toBe(true)
  await advance()
  expect(reads).toHaveLength(2)
  await act(async () => { reads[0]() })
  expect(result.current.readUnavailable).toBe(true)
  await act(async () => { reads[1](undefined, 403) })
  expect(result.current.readUnavailable).toBe(true)
  let fresh!: ReturnType<typeof result.current.refresh>
  act(() => { fresh = result.current.refresh() })
  await advance()
  await act(async () => { reads[2](); await fresh })
  expect(result.current.readUnavailable).toBe(false)
  expect(result.current.disconnected).toBe(true)
  expect(streams[0].closed).toBe(true)
})

it('coalesces events during a read into one catch-up without losing the latest view or notices', async () => {
  const { initial, fetcher, reads, observer, result } = fixture()
  projection()
  await advance(150)
  expect(fetcher).toHaveBeenCalledOnce()
  for (let index = 0; index < 20; index++) { projection(); await advance(200) }
  expect(fetcher).toHaveBeenCalledOnce()
  expect(observer).toHaveBeenCalledTimes(21)
  await act(async () => { reads[0]({ ...initial, inventoryPageCount: 3 }) })
  await advance(150)
  expect(fetcher).toHaveBeenCalledTimes(2)
  await act(async () => { reads[1]({ ...initial, inventoryPageCount: 12 }) })
  await advance(1000)
  expect(result.current.view.inventoryPageCount).toBe(12)
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('starts a scheduled read even when more events keep arriving before its delay elapses', async () => {
  const { fetcher, reads } = fixture()
  projection()
  await advance(50)
  projection()
  await advance(50)
  projection()
  await advance(50)
  expect(fetcher).toHaveBeenCalledOnce()
  await act(async () => { reads[0]() })
  await advance(200)
  expect(fetcher).toHaveBeenCalledOnce()
})

it('closes hidden streams, cancels scheduled reads, and resumes from the last cursor with a fresh view', async () => {
  const { initial, fetcher, observer, reads, result, unmount } = fixture()
  projection(streams[0], 'site-cursor/+with spaces')
  visible('hidden')
  expect(streams[0].closed).toBe(true)
  await advance(1000)
  expect(fetcher).not.toHaveBeenCalled()
  expect(result.current.disconnected).toBe(false)
  projection(streams[0])
  emit(streams[0], 'open')
  emit(streams[0], 'error')
  expect(observer).toHaveBeenCalledOnce()
  expect(result.current.disconnected).toBe(false)
  visible('visible')
  online(true)
  expect(streams).toHaveLength(2)
  expect(streams[1].url).toBe('/api/sites/fixture-site/events?after=site-cursor%2F%2Bwith%20spaces')
  emit(streams[1], 'open')
  await advance()
  expect(fetcher).toHaveBeenCalledOnce()
  await act(async () => { reads[0]({ ...initial, inventoryPageCount: 12 }) })
  expect(result.current.view.inventoryPageCount).toBe(12)
  expect(observer).toHaveBeenLastCalledWith({ type: 'reconnected' })
  unmount()
  expect(streams[1].closed).toBe(true)
  online(false); online(true); visible('visible')
  expect(streams).toHaveLength(2)
})

it('waits for both visibility and network availability before opening or resuming a stream', async () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  const { fetcher, result } = fixture()
  expect(streams).toHaveLength(0)
  online(true)
  expect(streams).toHaveLength(0)
  visible('visible')
  expect(streams).toHaveLength(1)
  online(false)
  expect(streams[0].closed).toBe(true)
  projection(streams[0]); emit(streams[0], 'open')
  await advance(1000)
  expect(fetcher).not.toHaveBeenCalled()
  expect(result.current.disconnected).toBe(false)
  visible('hidden'); online(true)
  expect(streams).toHaveLength(1)
  visible('visible')
  expect(streams).toHaveLength(2)
})

it('never reopens an expired stream on visibility or network changes', async () => {
  const { reads, fetcher, result } = fixture()
  emit(streams[0], 'access-expired')
  await advance()
  expect(streams[0].closed).toBe(true)
  expect(fetcher).toHaveBeenCalledOnce()
  await act(async () => { reads[0](undefined, 403) })
  expect(result.current.disconnected).toBe(true)
  visible('hidden'); online(false); visible('visible'); online(true)
  await advance(1000)
  expect(streams).toHaveLength(1)
  expect(fetcher).toHaveBeenCalledOnce()
})

it('does not let an older catch-up clear a newer stream failure or announce a reconnection', async () => {
  const { initial, reads, fetcher, observer, result } = fixture()
  emit(streams[0], 'open')
  await advance()
  emit(streams[0], 'error')
  emit(streams[0], 'open')
  await act(async () => { reads[0]({ ...initial, inventoryPageCount: 3 }) })
  expect(observer).not.toHaveBeenCalledWith({ type: 'reconnected' })
  expect(result.current.disconnected).toBe(true)
  await advance(150)
  expect(fetcher).toHaveBeenCalledTimes(2)
  await act(async () => { reads[1]({ ...initial, inventoryPageCount: 12 }) })
  expect(result.current.disconnected).toBe(false)
  expect(observer).toHaveBeenCalledExactlyOnceWith({ type: 'reconnected' })
})

it('keeps explicit post-action refresh independent of an older stream read', async () => {
  const { initial, reads, fetcher, result } = fixture()
  projection()
  await advance(150)
  let refresh!: ReturnType<typeof result.current.refresh>
  act(() => { refresh = result.current.refresh() })
  await advance()
  expect(fetcher).toHaveBeenCalledTimes(2)
  await act(async () => { reads[1]({ ...initial, inventoryPageCount: 12 }); await refresh })
  await act(async () => { reads[0]({ ...initial, inventoryPageCount: 3 }) })
  expect(result.current.view.inventoryPageCount).toBe(12)
  expect(result.current.disconnected).toBe(false)
})
