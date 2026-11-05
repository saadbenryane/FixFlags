import { act, cleanup, renderHook } from '@testing-library/react'
import { createElement, StrictMode, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useSiteAction } from '../useSiteAction'
import { SiteActionError } from '@/lib/sites/client-actions'
import { SITE_ACTION_COPY as C } from '@/lib/marketing/copy/site-actions'

beforeEach(() => { sessionStorage.clear() })
afterEach(() => { cleanup(); vi.useRealTimers() })

it('admits one mutation synchronously and publishes its confirmation before a slow refresh finishes', async () => {
  const { result } = renderHook(() => useSiteAction())
  let finish!: (value: string) => void, finishRefresh!: () => void
  const mutation = vi.fn((signal: AbortSignal) => {
    expect(signal.aborted).toBe(false)
    return new Promise<string>(resolve => { finish = resolve })
  })
  const refresh = vi.fn(() => new Promise<void>(resolve => { finishRefresh = resolve }))
  let pending!: ReturnType<typeof result.current.submit<string>>
  act(() => { pending = result.current.submit(mutation, value => value, refresh) })
  expect(await result.current.submit(mutation, () => 'Duplicate')).toEqual({ kind: 'busy' })
  expect(mutation).toHaveBeenCalledOnce()
  expect(mutation.mock.calls[0]).toEqual([expect.any(AbortSignal)])
  await act(async () => { finish('Check admitted') })
  expect(result.current.message).toBe('Check admitted')
  expect(result.current.busy).toBe(true)
  expect(refresh).toHaveBeenCalledOnce()
  await act(async () => { finishRefresh(); expect(await pending).toEqual({ kind: 'saved', data: 'Check admitted' }) })
  expect(result.current.busy).toBe(false)
})

it('retires immediately on unmount even when the mutation ignores cancellation, without late follow-up effects', async () => {
  const { result, unmount } = renderHook(() => useSiteAction())
  let finish!: (value: string) => void, pending!: ReturnType<typeof result.current.submit<string>>
  const mutation = vi.fn((signal: AbortSignal) => {
    expect(signal.aborted).toBe(false)
    return new Promise<string>(resolve => { finish = resolve })
  })
  const confirmed = vi.fn(() => 'Confirmed'), refresh = vi.fn()
  act(() => { pending = result.current.submit(mutation, confirmed, refresh) })
  const signal = mutation.mock.calls[0][0] as AbortSignal
  unmount()
  expect(signal.aborted).toBe(true)
  expect(await pending).toEqual({ kind: 'retired' })
  await act(async () => { finish('Late receipt') })
  expect(confirmed).not.toHaveBeenCalled()
  expect(refresh).not.toHaveBeenCalled()
})

it('starts a new scope without inheriting busy state, while retaining the namespace’s uncertain retry key', async () => {
  const { result, rerender } = renderHook(({ scope }) => useSiteAction({ namespace: 'site:owned', scope }), { initialProps: { scope: 'first' } })
  const retryKey = result.current.requestKey('outcome:first')
  let finishFirst!: (value: string) => void, finishSecond!: (value: string) => void
  const first = vi.fn(() => new Promise<string>(resolve => { finishFirst = resolve }))
  const second = vi.fn(() => new Promise<string>(resolve => { finishSecond = resolve }))
  const oldConfirmed = vi.fn(() => 'Earlier confirmation'), oldRefresh = vi.fn()
  const oldSubmit = result.current.submit
  let oldPending!: ReturnType<typeof oldSubmit<string>>
  act(() => { oldPending = oldSubmit(first, oldConfirmed, oldRefresh) })
  rerender({ scope: 'second' })
  expect(await oldPending).toEqual({ kind: 'retired' })
  expect(result.current.busy).toBe(false)
  expect(result.current.message).toBeNull()
  expect(result.current.requestKey('outcome:first')).toBe(retryKey)
  expect(await oldSubmit(first, oldConfirmed)).toEqual({ kind: 'retired' })
  expect(first).toHaveBeenCalledOnce()
  let nextPending!: ReturnType<typeof result.current.submit<string>>
  act(() => { nextPending = result.current.submit(second, () => 'Current confirmation') })
  await act(async () => { finishFirst('Old receipt') })
  expect(result.current.busy).toBe(true)
  expect(result.current.message).toBeNull()
  expect(oldConfirmed).not.toHaveBeenCalled()
  expect(oldRefresh).not.toHaveBeenCalled()
  await act(async () => { finishSecond('Current receipt'); await nextPending })
  expect(result.current.message).toBe('Current confirmation')
  expect(result.current.busy).toBe(false)
})

it('keeps actionable mutation refusals intact and does not refresh or retire their retry key', async () => {
  const { result } = renderHook(() => useSiteAction({ namespace: 'site:owned' }))
  const key = result.current.requestKey('check')
  const error = new SiteActionError('Claim this Site first.', 403, 'SITE_CLAIM_REQUIRED')
  const confirmed = vi.fn(), refresh = vi.fn()
  await act(async () => { expect(await result.current.submit(async () => { throw error }, confirmed, refresh)).toEqual({ kind: 'refused', error }) })
  expect(result.current.error).toBe(error)
  expect(result.current.message).toBe(error.message)
  expect(result.current.requestKey('check')).toBe(key)
  expect(confirmed).not.toHaveBeenCalled()
  expect(refresh).not.toHaveBeenCalled()
  act(() => result.current.clearFeedback())
  expect(result.current.error).toBeNull()
  expect(result.current.message).toBeNull()
})

it('retires an earlier namespace even when the view label stays the same', async () => {
  const { result, rerender } = renderHook(({ namespace }) => useSiteAction({ namespace, scope: 'settings' }), { initialProps: { namespace: 'site:first' } })
  const oldKey = result.current.requestKey('cleanup')
  const confirmed = vi.fn(() => 'Old confirmation')
  let finish!: (value: string) => void, pending!: ReturnType<typeof result.current.submit<string>>
  act(() => { pending = result.current.submit(() => new Promise<string>(resolve => { finish = resolve }), confirmed) })
  rerender({ namespace: 'site:second' })
  expect(await pending).toEqual({ kind: 'retired' })
  expect(result.current.requestKey('cleanup')).not.toBe(oldKey)
  expect(result.current.busy).toBe(false)
  await act(async () => { finish('Late first-Site receipt') })
  expect(result.current.message).toBeNull()
  expect(confirmed).not.toHaveBeenCalled()
})

it('distinguishes a confirmed change from a failed follow-up read', async () => {
  const { result } = renderHook(() => useSiteAction())
  const confirmed = vi.fn(() => 'Saved')
  await act(async () => { expect(await result.current.submit(async () => 'receipt', confirmed, async () => { throw new Error('Read failed') }))
    .toEqual({ kind: 'saved_refresh_pending', data: 'receipt' }) })
  expect(confirmed).toHaveBeenCalledOnce()
  expect(result.current.message).toBe(C.refreshPending)
  expect(result.current.error).toBeNull()
  expect(result.current.busy).toBe(false)
})

it('cancels a follow-up read when its view leaves without changing the already confirmed mutation', async () => {
  const { result, unmount } = renderHook(() => useSiteAction())
  let release!: () => void, signal!: AbortSignal, pending!: ReturnType<typeof result.current.submit<string>>
  const confirmed = vi.fn(() => 'Saved')
  await act(async () => { pending = result.current.submit(async () => 'receipt', confirmed, active => {
    signal = active
    return new Promise<void>(resolve => { release = resolve })
  }) })
  expect(confirmed).toHaveBeenCalledOnce()
  unmount()
  expect(signal.aborted).toBe(true)
  expect(await pending).toEqual({ kind: 'retired' })
  await act(async () => { release() })
  expect(confirmed).toHaveBeenCalledOnce()
})

it('starts after effect replay with a live owner', async () => {
  const { result } = renderHook(() => useSiteAction(), { wrapper: ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children) })
  await act(async () => { expect(await result.current.submit(async signal => {
    expect(signal.aborted).toBe(false)
    return 'receipt'
  }, () => 'Saved')).toEqual({ kind: 'saved', data: 'receipt' }) })
  expect(result.current.message).toBe('Saved')
})

it('leaves each operation’s own deadline intact while the view remains active', async () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useSiteAction())
  let finish!: (value: string) => void, signal!: AbortSignal, pending!: ReturnType<typeof result.current.submit<string>>
  act(() => { pending = result.current.submit(active => {
    signal = active
    return new Promise<string>(resolve => { finish = resolve })
  }, () => 'Saved') })
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(result.current.busy).toBe(true)
  expect(signal.aborted).toBe(false)
  await act(async () => { finish('receipt'); await pending })
  expect(result.current.busy).toBe(false)
})
