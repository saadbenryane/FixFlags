import { createElement, type ReactNode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useOAuthProviders } from '../useOAuthProviders'

function context() {
  const cache = new Map()
  return function Provider({ children }: { children: ReactNode }) {
    return createElement(SWRConfig, { value: { provider: () => cache } }, children)
  }
}
async function advance(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('shares in-flight discovery, keeps joining consumers connected, and reuses the validated answer on remount', async () => {
  let finish!: (response: Response) => void
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetcher)
  const cache = new Map()
  let showFirst = true
  const firstResult = vi.fn()
  function FirstConsumer() { firstResult(useOAuthProviders()); return null }
  function Provider({ children }: { children: ReactNode }) {
    return createElement(SWRConfig, { value: { provider: () => cache } },
      showFirst ? createElement(FirstConsumer) : null, children)
  }
  const wrapper = Provider
  const second = renderHook(() => useOAuthProviders(), { wrapper })
  expect(firstResult).toHaveBeenLastCalledWith(expect.objectContaining({ isLoading: true }))
  expect(second.result.current.isLoading).toBe(true)
  expect(fetcher).toHaveBeenCalledOnce()
  showFirst = false
  second.rerender()
  await act(async () => { finish(Response.json({ google: true, github: false })) })
  expect(second.result.current).toMatchObject({ google: true, github: false, anyEnabled: true, isLoading: false, error: false })
  second.unmount()
  const next = renderHook(() => useOAuthProviders(), { wrapper })
  expect(next.result.current.google).toBe(true)
  expect(next.result.current.isLoading).toBe(false)
  await advance(10_000)
  expect(fetcher).toHaveBeenCalledExactlyOnceWith('/api/auth/providers', expect.objectContaining({ cache: 'no-store' }))
})

it.each(['headers', 'body'] as const)('bounds stalled %s, offers an explicit retry, and ignores late provider options', async phase => {
  let finish!: (value: unknown) => void, signal!: AbortSignal
  const fetcher = vi.fn().mockImplementationOnce((_url, options) => {
    signal = options.signal
    if (phase === 'headers') return new Promise<Response>(resolve => { finish = body => resolve(Response.json(body)) })
    return Promise.resolve({ ok: true, json: () => new Promise(resolve => { finish = resolve }) } as Response)
  }).mockResolvedValueOnce(Response.json({ google: false, github: true }))
  vi.stubGlobal('fetch', fetcher)
  const { result } = renderHook(() => useOAuthProviders(), { wrapper: context() })
  await advance(15_000)
  expect(signal.aborted).toBe(true)
  expect(result.current).toMatchObject({ error: true, isLoading: false, anyEnabled: false })
  await advance(120_000)
  expect(fetcher).toHaveBeenCalledOnce()
  act(() => { result.current.retry(); result.current.retry() })
  await advance()
  expect(result.current).toMatchObject({ google: false, github: true, error: false, isLoading: false })
  expect(fetcher).toHaveBeenCalledTimes(2)
  await act(async () => { finish({ google: true, github: false }) })
  expect(result.current).toMatchObject({ google: false, github: true, error: false })
})

it.each([null, {}, { google: 'false', github: false }, { google: false, github: 1 }])('rejects malformed provider facts rather than coercing or silently disabling them: %j', async body => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(body)))
  const { result } = renderHook(() => useOAuthProviders(), { wrapper: context() })
  await advance()
  expect(result.current).toMatchObject({ google: false, github: false, error: true, isLoading: false, anyEnabled: false })
})

it('accepts both providers being disabled as a valid configuration', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ google: false, github: false })))
  const { result } = renderHook(() => useOAuthProviders(), { wrapper: context() })
  await advance()
  expect(result.current).toMatchObject({ google: false, github: false, error: false, isLoading: false, anyEnabled: false })
})
