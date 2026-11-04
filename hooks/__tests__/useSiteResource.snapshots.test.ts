import { createElement, useState, type ReactNode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useSiteResource } from '../useSiteResource'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('EventSource', undefined) })
afterEach(async () => {
  cleanup()
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  vi.useRealTimers(); vi.unstubAllGlobals()
})
const wrapper = ({ children }: { children: ReactNode }) => createElement(SWRConfig, { value: {
  provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false,
  isVisible: () => true, isOnline: () => true,
} }, children)
function snapshot(readAt: number, inventoryPageCount: number, status = 'COMPLETED') {
  const view = siteViewFixture(); view.outcomes = []
  return { ...view, readAt, inventoryPageCount, audit: { ...view.audit, status } }
}
async function advance(ms = 20) { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

it('publishes newer server-rendered evidence without another fetch or losing the current draft', async () => {
  const initial = snapshot(1000, 1), newer = snapshot(3000, 3)
  const fetcher = vi.fn(async () => Response.json(initial))
  vi.stubGlobal('fetch', fetcher)
  const { result, rerender } = renderHook(({ initial }) => {
    const resource = useSiteResource(initial.site.siteId, initial)
    const [draft, setDraft] = useState('')
    return { ...resource, draft, setDraft }
  }, { wrapper, initialProps: { initial } })
  await advance()
  act(() => result.current.setDraft('Keep my verification note'))
  rerender({ initial: newer })
  expect(result.current.view.inventoryPageCount).toBe(3)
  expect(result.current.draft).toBe('Keep my verification note')
  expect(fetcher).toHaveBeenCalledOnce()
})

it('retains a newer browser read when an earlier server snapshot arrives', async () => {
  const initial = snapshot(1000, 1), current = snapshot(3000, 3)
  const fetcher = vi.fn(async () => Response.json(current))
  vi.stubGlobal('fetch', fetcher)
  const { result, rerender } = renderHook(({ initial }) => useSiteResource(initial.site.siteId, initial), { wrapper, initialProps: { initial } })
  await advance()
  rerender({ initial: snapshot(2000, 2) })
  expect(result.current.view.inventoryPageCount).toBe(3)
  expect(fetcher).toHaveBeenCalledOnce()
})

it('prevents an earlier in-flight response from downgrading a server refresh, then accepts a later read', async () => {
  const initial = snapshot(1000, 1)
  let finish!: (response: Response) => void
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
    .mockImplementation(async () => Response.json(snapshot(4000, 4)))
  vi.stubGlobal('fetch', fetcher)
  const { result, rerender } = renderHook(({ initial }) => useSiteResource(initial.site.siteId, initial), { wrapper, initialProps: { initial } })
  await advance()
  rerender({ initial: snapshot(3000, 3) })
  await act(async () => { finish(Response.json(snapshot(2000, 2))) })
  expect(result.current.view.inventoryPageCount).toBe(3)
  await act(async () => { await result.current.refresh() })
  expect(result.current.view.inventoryPageCount).toBe(4)
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('uses the newer server snapshot to stop polling work that has already finished', async () => {
  const initial = snapshot(1000, 1, 'CHECKING')
  const fetcher = vi.fn(async () => Response.json(initial))
  vi.stubGlobal('fetch', fetcher)
  const { result, rerender } = renderHook(({ initial }) => useSiteResource(initial.site.siteId, initial), { wrapper, initialProps: { initial } })
  await advance()
  rerender({ initial: snapshot(3000, 3) })
  await advance(10_000)
  expect(fetcher).toHaveBeenCalledOnce()
  expect(result.current.view.audit.status).toBe('COMPLETED')
})

it('keeps valid unversioned responses usable with an older wire format', async () => {
  const initial = snapshot(1000, 1), legacy = siteViewFixture()
  legacy.outcomes = []; legacy.inventoryPageCount = 4
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(legacy)))
  const { result } = renderHook(() => useSiteResource(initial.site.siteId, initial), { wrapper })
  await advance()
  expect(result.current.view.inventoryPageCount).toBe(4)
})
