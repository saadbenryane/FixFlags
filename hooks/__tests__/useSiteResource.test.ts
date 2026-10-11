import { createElement } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
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
