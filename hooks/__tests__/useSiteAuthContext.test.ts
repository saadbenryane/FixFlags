import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useSiteAuthContext } from '../useSiteAuthContext'

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('uses a small Site identity read and retains query and fragment changes without refetching the same Site', async () => {
  const fetcher = vi.fn(async () => Response.json({ siteId: 'site', hostname: 'example.com' }))
  vi.stubGlobal('fetch', fetcher)
  const { result, rerender } = renderHook(({ next }) => useSiteAuthContext(next), { initialProps: { next: '/sites/site?flag=first#evidence' } })
  await act(async () => {})
  expect(result.current).toEqual({ siteHref: '/sites/site?flag=first#evidence', hostname: 'example.com', isSiteContext: true })
  rerender({ next: '/sites/site?flag=second#evidence' })
  expect(result.current.siteHref).toBe('/sites/site?flag=second#evidence')
  expect(result.current.hostname).toBe('example.com')
  expect(fetcher).toHaveBeenCalledExactlyOnceWith('/api/sites/site?scope=identity', expect.objectContaining({ cache: 'no-store' }))
})

it('retains authorized legacy report identity without treating malformed URLs as hostnames', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 'report', url: 'https://www.example.com/scope' })))
  const { result } = renderHook(() => useSiteAuthContext('/report/report#evidence'))
  await act(async () => {})
  expect(result.current).toEqual({ siteHref: '/report/report#evidence', hostname: 'example.com', isSiteContext: true })
})

it('immediately retires another Site’s name and ignores its delayed body after navigation', async () => {
  let finish!: (value: unknown) => void, signal!: AbortSignal
  const fetcher = vi.fn().mockImplementationOnce((_url, options) => {
    signal = options.signal
    return Promise.resolve({ ok: true, json: () => new Promise(resolve => { finish = resolve }) } as Response)
  }).mockResolvedValueOnce(Response.json({ siteId: 'next', hostname: 'current.example' }))
  vi.stubGlobal('fetch', fetcher)
  const { result, rerender } = renderHook(({ next }) => useSiteAuthContext(next), { initialProps: { next: '/sites/first' } })
  await act(async () => {})
  rerender({ next: '/sites/next' })
  expect(result.current.hostname).toBeNull()
  expect(signal.aborted).toBe(true)
  await act(async () => {})
  expect(result.current.hostname).toBe('current.example')
  await act(async () => { finish({ siteId: 'first', hostname: 'previous.example' }) })
  expect(result.current.hostname).toBe('current.example')
})

it('does not resurrect an old identity when returning after another Site lookup failed', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ siteId: 'first', hostname: 'previous.example' }))
    .mockImplementation(async () => Response.json({}, { status: 404 }))
  vi.stubGlobal('fetch', fetcher)
  const { result, rerender } = renderHook(({ next }) => useSiteAuthContext(next), { initialProps: { next: '/sites/first' } })
  await act(async () => {})
  expect(result.current.hostname).toBe('previous.example')
  rerender({ next: '/sites/next' })
  expect(result.current.hostname).toBeNull()
  await act(async () => {})
  rerender({ next: '/sites/first' })
  expect(result.current.hostname).toBeNull()
  await act(async () => {})
  expect(result.current.hostname).toBeNull()
  expect(fetcher).toHaveBeenCalledTimes(3)
})

it.each(['headers', 'body'] as const)('bounds an optional context lookup through stalled %s and ignores a late result', async phase => {
  vi.useFakeTimers()
  let finish!: (body: unknown) => void, signal!: AbortSignal
  vi.stubGlobal('fetch', vi.fn((_url, options) => {
    signal = options.signal
    if (phase === 'headers') return new Promise<Response>(resolve => { finish = body => resolve(Response.json(body)) })
    return Promise.resolve({ ok: true, json: () => new Promise(resolve => { finish = resolve }) } as Response)
  }))
  const { result } = renderHook(() => useSiteAuthContext('/sites/site'))
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
  expect(signal.aborted).toBe(true)
  expect(result.current).toEqual({ siteHref: '/sites/site', hostname: null, isSiteContext: true })
  await act(async () => { finish({ siteId: 'site', hostname: 'late.example' }) })
  expect(result.current.hostname).toBeNull()
})

it.each([
  { siteId: 'other', hostname: 'private.example' }, { siteId: 'site', hostname: 'https://misleading.example/path' },
  { siteId: 'site', hostname: 'not a hostname' }, { siteId: 'site', hostname: 'user:secret@example.com' },
])('does not display malformed or differently scoped identity data: %j', async body => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(body)))
  const { result } = renderHook(() => useSiteAuthContext('/sites/site'))
  await act(async () => {})
  expect(result.current.hostname).toBeNull()
})

it('clears context on a non-Site destination without issuing another request', async () => {
  const fetcher = vi.fn(async () => Response.json({ siteId: 'site', hostname: 'example.com' }))
  vi.stubGlobal('fetch', fetcher)
  const { result, rerender } = renderHook(({ next }) => useSiteAuthContext(next), { initialProps: { next: '/sites/site' } })
  await act(async () => {})
  rerender({ next: '/dashboard' })
  expect(result.current).toEqual({ hostname: null, siteHref: null, isSiteContext: false })
  expect(fetcher).toHaveBeenCalledOnce()
})
