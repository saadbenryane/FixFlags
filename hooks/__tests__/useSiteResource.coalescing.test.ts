import { createElement, type ReactNode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useSiteResource } from '../useSiteResource'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('EventSource', undefined)
})
afterEach(async () => {
  cleanup()
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  vi.useRealTimers(); vi.unstubAllGlobals()
})

const wrapper = ({ children }: { children: ReactNode }) => createElement(SWRConfig, { value: {
  provider: () => new Map(), dedupingInterval: 0, focusThrottleInterval: 0,
  shouldRetryOnError: false, isVisible: () => true, isOnline: () => true,
} }, children)

it.each(['poll', 'focus'])('lets a background %s share the current refresh without another HTTP read', async trigger => {
  const initial = siteViewFixture(); initial.outcomes = []; initial.audit.status = 'CHECKING'
  const completed = structuredClone(initial); completed.audit.status = 'COMPLETED'; completed.inventoryPageCount = 12
  let finish!: (response: Response) => void
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(initial))
    .mockImplementation(() => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetcher)
  const { result } = renderHook(() => useSiteResource(initial.site.siteId, initial), { wrapper })
  await act(async () => { await vi.advanceTimersByTimeAsync(20) })
  expect(fetcher).toHaveBeenCalledOnce()
  let refreshed!: Promise<unknown>
  act(() => { refreshed = result.current.refresh().catch(() => undefined) })
  await act(async () => { await vi.advanceTimersByTimeAsync(20) })
  expect(fetcher).toHaveBeenCalledTimes(2)
  if (trigger === 'focus') act(() => window.dispatchEvent(new Event('focus')))
  await act(async () => { await vi.advanceTimersByTimeAsync(trigger === 'poll' ? 3000 : 20) })
  expect(fetcher).toHaveBeenCalledTimes(2)
  await act(async () => { finish(Response.json(completed)); await refreshed })
  expect(result.current.view.inventoryPageCount).toBe(12)
  expect(result.current.disconnected).toBe(false)
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
  expect(fetcher).toHaveBeenCalledTimes(2)
})
