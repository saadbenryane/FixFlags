import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAuthRedirect } from '../useAuthRedirect'

const route = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), navigate: vi.fn(), error: vi.fn(), query: new URLSearchParams() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: route.push, replace: route.replace }), useSearchParams: () => route.query }))
vi.mock('sonner', () => ({ toast: { error: route.error } }))
beforeEach(async () => {
  vi.useFakeTimers(); vi.clearAllMocks(); route.query = new URLSearchParams('plan=BUILDER')
  vi.stubGlobal('window', { ...window, location: { assign: route.navigate } })
  await import('@/lib/billing/client-checkout')
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('admits one post-login checkout and confirms its destination before leaving', async () => {
  let finish!: (response: Response) => void
  const fetch = vi.fn<(url: string, options: RequestInit) => Promise<Response>>(() => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetch)
  const { result } = renderHook(useAuthRedirect)
  let first!: Promise<void>, second!: Promise<void>
  act(() => { first = result.current.navigateAfterAuth(); second = result.current.navigateAfterAuth() })
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(fetch).toHaveBeenCalledOnce()
  expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({ plan: 'BUILDER' })
  await act(async () => { finish(Response.json({ url: 'https://checkout.example/confirmed' })); await Promise.all([first, second]) })
  expect(route.navigate).toHaveBeenCalledExactlyOnceWith('https://checkout.example/confirmed')
  expect(route.push).not.toHaveBeenCalled(); expect(route.replace).not.toHaveBeenCalled()
})

it.each(['javascript:alert(1)', 'http://checkout.example/invalid', 'https://user:secret@checkout.example/invalid', ''])
('keeps an unusable checkout destination out of the sign-in handoff: %s', async url => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ url })))
  const { result } = renderHook(useAuthRedirect)
  await act(async () => { await result.current.navigateAfterAuth() })
  expect(route.navigate).not.toHaveBeenCalled()
  expect(route.error).toHaveBeenCalledOnce()
  expect(route.push).toHaveBeenCalledExactlyOnceWith('/pricing')
})

it('returns a stalled checkout to the existing pricing recovery route', async () => {
  let signal!: AbortSignal
  vi.stubGlobal('fetch', vi.fn((_url, options) => { signal = options.signal; return new Promise<Response>(() => {}) }))
  const { result } = renderHook(useAuthRedirect)
  let pending!: Promise<void>
  act(() => { pending = result.current.navigateAfterAuth() })
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); await pending })
  expect(signal.aborted).toBe(true)
  expect(route.error).toHaveBeenCalledOnce()
  expect(route.push).toHaveBeenCalledExactlyOnceWith('/pricing')
})

it.each(['unmount', 'destination'] as const)('retires a late checkout after the %s changes', async change => {
  let signal!: AbortSignal, finish!: (response: Response) => void
  const fetch = vi.fn((_url, options) => { signal = options.signal; return new Promise<Response>(resolve => { finish = resolve }) })
  vi.stubGlobal('fetch', fetch)
  const hook = renderHook(useAuthRedirect)
  let pending!: Promise<void>
  act(() => { pending = hook.result.current.navigateAfterAuth() })
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  if (change === 'unmount') hook.unmount()
  else { route.query = new URLSearchParams({ next: '/sites/other?view=pages#pages' }); hook.rerender() }
  expect(signal.aborted).toBe(true)
  await act(async () => { finish(Response.json({ url: 'https://checkout.example/obsolete' })); await pending })
  expect(route.navigate).not.toHaveBeenCalled(); expect(route.error).not.toHaveBeenCalled(); expect(route.push).not.toHaveBeenCalled()
  if (change === 'destination') {
    await act(async () => { await hook.result.current.navigateAfterAuth() })
    expect(route.replace).toHaveBeenCalledExactlyOnceWith('/sites/other?view=pages#pages')
  }
})
