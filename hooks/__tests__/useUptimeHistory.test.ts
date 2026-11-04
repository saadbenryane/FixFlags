import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useUptimeHistory } from '../useUptimeHistory'
import type { UptimeHistory } from '@/lib/uptime/domain'

function page(ids = ['first'], nextCursor: string | null = 'first', window: UptimeHistory['window'] = '24h'): UptimeHistory {
  return { enabled: true, targetUrl: 'https://example.com/', state: 'online', lastCheckedAt: '2026-11-03T12:00:00.000Z', nextCheckAt: null,
    openIncidentCount: 0, segments: [], window, incidents: [], nextCursor,
    historyScope: { key: 'monitor:1', from: '2026-11-03T00:00:00.000Z', through: '2026-11-03T12:00:00.000Z' },
    probes: ids.map((id, index) => ({ id, observedAt: `2026-11-03T${String(11 - index).padStart(2, '0')}:00:00.000Z`,
      scheduledAt: '2026-11-03T00:00:00.000Z', attempt: 1, confirmed: false, targetUrl: 'https://example.com/',
      result: 'ONLINE', reason: 'response_received', statusCode: 200, durationMs: 20, finalUrl: 'https://example.com/' })) }
}
const reply = (data = page(), siteId = 'site') => Response.json({ siteId, ...data })
const mount = () => renderHook(({ siteId, window, open }) => useUptimeHistory(siteId, window, open), {
  initialProps: { siteId: 'site', window: '24h' as UptimeHistory['window'], open: true },
})
async function advance(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
beforeEach(() => { vi.useFakeTimers(); vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible'); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it.each(['headers', 'body'] as const)('bounds stalled %s, enables retry, and ignores the timed-out result', async phase => {
  let finish!: (body: unknown) => void, signal!: AbortSignal
  const fetcher = vi.fn().mockImplementationOnce((_url, options) => {
    signal = options.signal
    if (phase === 'headers') return new Promise<Response>(resolve => { finish = body => resolve(Response.json(body)) })
    return Promise.resolve({ ok: true, json: () => new Promise(resolve => { finish = resolve }) } as Response)
  }).mockImplementation(async () => reply())
  vi.stubGlobal('fetch', fetcher)
  const { result } = mount()
  await advance(15_000)
  expect(signal.aborted).toBe(true)
  expect(result.current.loading).toBe(false)
  expect(result.current.error).toBe(true)
  await act(async () => { await result.current.retry() })
  expect(result.current.history?.probes.map(probe => probe.id)).toEqual(['first'])
  expect(result.current.error).toBe(false)
  await act(async () => { finish({ siteId: 'site', ...page(['late']) }) })
  expect(result.current.history?.probes.map(probe => probe.id)).toEqual(['first'])
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('serializes rapid pagination and a polling tick, then retries the failed page without dropping recorded checks', async () => {
  let finish!: (response: Response) => void
  const older = page(['older'], null)
  older.probes[0].observedAt = '2026-11-03T10:00:00.000Z'
  const fetcher = vi.fn().mockResolvedValueOnce(reply())
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
    .mockResolvedValueOnce(reply(older))
  vi.stubGlobal('fetch', fetcher)
  const { result } = mount()
  await advance(59_000)
  let first!: Promise<void>, duplicate!: Promise<void>
  act(() => { first = result.current.loadMore(); duplicate = result.current.loadMore() })
  await advance(1000)
  expect(fetcher).toHaveBeenCalledTimes(2)
  await act(async () => { finish(Response.json({}, { status: 503 })); await Promise.all([first, duplicate]) })
  expect(result.current.history?.probes.map(probe => probe.id)).toEqual(['first'])
  expect(result.current.error).toBe(true)
  await act(async () => { await result.current.retry() })
  expect(fetcher.mock.calls[2][0]).toBe('/api/sites/site/uptime?window=24h&cursor=first')
  expect(result.current.history?.probes.map(probe => probe.id)).toEqual(['first', 'older'])
  expect(result.current.history?.nextCursor).toBeNull()
})

it.each(['close', 'site', 'window'] as const)('retires an in-flight page on %s and prevents a late append', async change => {
  let finish!: (response: Response) => void, signal!: AbortSignal
  const fetcher = vi.fn().mockResolvedValueOnce(reply())
    .mockImplementationOnce((_url, options) => { signal = options.signal; return new Promise<Response>(resolve => { finish = resolve }) })
    .mockImplementation(async url => {
      const parsed = new URL(url, 'https://fixflags.test')
      return reply(page(['current'], null, parsed.searchParams.get('window') as UptimeHistory['window']), parsed.pathname.includes('/next/') ? 'next' : 'site')
    })
  vi.stubGlobal('fetch', fetcher)
  const { result, rerender, unmount } = mount()
  await advance()
  let pending!: Promise<void>
  act(() => { pending = result.current.loadMore() })
  rerender({ siteId: change === 'site' ? 'next' : 'site', window: change === 'window' ? '7d' : '24h', open: change !== 'close' })
  expect(signal.aborted).toBe(true)
  if (change === 'close') expect(result.current.history?.probes.map(probe => probe.id)).toEqual(['first'])
  else expect(result.current.history).toBeNull()
  await advance()
  await act(async () => { finish(reply(page(['late'], null))); await pending })
  expect(result.current.history?.probes.some(probe => probe.id === 'late')).not.toBe(true)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('preserves compatible loaded pages during a live refresh, including the oldest continuation', async () => {
  const first = page(['first']), older = page(['older'], 'older')
  older.probes[0].observedAt = '2026-11-03T10:00:00.000Z'
  const fresh = page(['new', 'first'])
  fresh.probes[0].observedAt = '2026-11-03T12:00:00.000Z'
  fresh.probes[1].observedAt = first.probes[0].observedAt
  const fetcher = vi.fn().mockResolvedValueOnce(reply(first)).mockResolvedValueOnce(reply(older)).mockResolvedValueOnce(reply(fresh))
  vi.stubGlobal('fetch', fetcher)
  const { result } = mount()
  await advance()
  await act(async () => { await result.current.loadMore() })
  await advance(60_000)
  expect(result.current.history?.probes.map(probe => probe.id)).toEqual(['new', 'first', 'older'])
  expect(result.current.history?.nextCursor).toBe('older')
})

it('retires an old target request and its retained status before displaying the new target', async () => {
  let finish!: (response: Response) => void, signal!: AbortSignal
  const fresh = { ...page(['current'], null), targetUrl: 'https://example.com/new' }
  fresh.probes = fresh.probes.map(probe => ({ ...probe, targetUrl: fresh.targetUrl, finalUrl: fresh.targetUrl }))
  const fetcher = vi.fn().mockResolvedValueOnce(reply())
    .mockImplementationOnce((_url, options) => { signal = options.signal; return new Promise<Response>(resolve => { finish = resolve }) })
    .mockResolvedValueOnce(reply(fresh))
  vi.stubGlobal('fetch', fetcher)
  const { result, rerender } = renderHook(({ target }) => useUptimeHistory('site', '24h', true, undefined, target), {
    initialProps: { target: 'https://example.com/' },
  })
  await advance()
  expect(result.current.latest?.targetUrl).toBe('https://example.com/')
  let pending!: Promise<void>
  act(() => { pending = result.current.loadMore() })
  rerender({ target: fresh.targetUrl })
  expect(signal.aborted).toBe(true)
  expect(result.current.history).toBeNull()
  expect(result.current.latest).toBeNull()
  await advance()
  await act(async () => { finish(reply(page(['late'], null))); await pending })
  expect(result.current.history?.probes.map(probe => probe.id)).toEqual(['current'])
  expect(result.current.latest?.targetUrl).toBe(fresh.targetUrl)
})

it('rejects a response for the previous target instead of publishing its status', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => reply()))
  const { result } = renderHook(() => useUptimeHistory('site', '24h', true, undefined, 'https://example.com/new'))
  await advance()
  expect(result.current.error).toBe(true)
  expect(result.current.history).toBeNull()
  expect(result.current.latest).toBeNull()
})

it('reopens during an interrupted read without blocking the new request or accepting the late result', async () => {
  let finish!: (response: Response) => void, signal!: AbortSignal
  const fetcher = vi.fn().mockImplementationOnce((_url, options) => {
    signal = options.signal
    return new Promise<Response>(resolve => { finish = resolve })
  }).mockResolvedValueOnce(reply(page(['current'], null)))
  vi.stubGlobal('fetch', fetcher)
  const { result, rerender } = mount()
  await advance()
  rerender({ siteId: 'site', window: '24h', open: false })
  expect(signal.aborted).toBe(true)
  rerender({ siteId: 'site', window: '24h', open: true })
  await advance()
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(result.current.history?.probes.map(probe => probe.id)).toEqual(['current'])
  await act(async () => { finish(reply(page(['late'], null))) })
  expect(result.current.history?.probes.map(probe => probe.id)).toEqual(['current'])
  expect(result.current.latest?.probes.map(probe => probe.id)).toEqual(['current'])
})

it('recovers a cursor refused after retargeting by retrying from the first page', async () => {
  const updated = page(['new-target'], null); updated.historyScope!.key = 'monitor:2'
  const fetcher = vi.fn().mockResolvedValueOnce(reply()).mockResolvedValueOnce(Response.json({}, { status: 400 }))
    .mockResolvedValueOnce(reply(updated))
  vi.stubGlobal('fetch', fetcher)
  const { result } = mount()
  await advance()
  await act(async () => { await result.current.loadMore() })
  expect(result.current.error).toBe(true)
  await act(async () => { await result.current.retry() })
  expect(fetcher.mock.calls[2][0]).toBe('/api/sites/site/uptime?window=24h')
  expect(result.current.history?.probes.map(probe => probe.id)).toEqual(['new-target'])
})

it('pauses background reads when hidden or offline and catches up on return', async () => {
  const fetcher = vi.fn(async () => reply())
  vi.stubGlobal('fetch', fetcher)
  const { unmount } = mount()
  await advance()
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  await advance(60_000)
  expect(fetcher).toHaveBeenCalledOnce()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  await advance(60_000)
  expect(fetcher).toHaveBeenCalledOnce()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  act(() => window.dispatchEvent(new Event('online')))
  await advance()
  expect(fetcher).toHaveBeenCalledTimes(2)
  unmount()
  act(() => window.dispatchEvent(new Event('online')))
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(vi.getTimerCount()).toBe(0)
})

it('keeps local sample history available without issuing a request', async () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const source = vi.fn(window => page(['sample'], null, window))
  const { result } = renderHook(() => useUptimeHistory('sample', '7d', true, source))
  await advance(120_000)
  expect(result.current.history?.window).toBe('7d')
  expect(source).toHaveBeenCalledOnce()
  expect(fetcher).not.toHaveBeenCalled()
})
