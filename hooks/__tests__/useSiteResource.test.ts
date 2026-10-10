import { createElement } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, expect, it, vi } from 'vitest'
import { useSiteResource } from '../useSiteResource'
import type { SiteHomeView } from '@/lib/sites/application/queries'

it('keeps updating after analysis finishes until the independent result arrives, then stops polling', async () => {
  const pending = { audit: { status: 'COMPLETED' }, outcomes: [{ running: true, lastVerifiedAt: null }] } as unknown as SiteHomeView
  const finished = { ...pending, outcomes: [{ running: false, lastVerifiedAt: '2026-10-10T15:00:00Z' }] } as SiteHomeView
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
afterEach(() => { vi.unstubAllGlobals() })
