import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useMinuteClock } from '../useMinuteClock'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-03T12:00:00Z'))
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

it('shares one timer across mounted displays and releases it after the last subscriber', async () => {
  const first = renderHook(() => useMinuteClock())
  const second = renderHook(() => useMinuteClock())
  expect(vi.getTimerCount()).toBe(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(first.result.current).toBe(Date.parse('2026-11-03T12:01:00Z'))
  expect(second.result.current).toBe(first.result.current)
  first.unmount()
  expect(vi.getTimerCount()).toBe(1)
  second.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('pauses hidden-page work and catches up immediately when the page becomes visible', async () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get')
  const view = renderHook(() => useMinuteClock())
  const initial = view.result.current
  visibility.mockReturnValue('hidden')
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(vi.getTimerCount()).toBe(0)
  await act(async () => { await vi.advanceTimersByTimeAsync(3600_000) })
  expect(view.result.current).toBe(initial)
  visibility.mockReturnValue('visible')
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(view.result.current).toBe(Date.parse('2026-11-03T13:00:00Z'))
  expect(vi.getTimerCount()).toBe(1)
})

it('does not subscribe an authored reference clock and retires a disabled live display', () => {
  const view = renderHook(({ enabled }) => useMinuteClock(enabled), { initialProps: { enabled: false } })
  expect(view.result.current).toBeNull()
  expect(vi.getTimerCount()).toBe(0)
  view.rerender({ enabled: true })
  expect(view.result.current).toBe(Date.now())
  expect(vi.getTimerCount()).toBe(1)
  view.rerender({ enabled: false })
  expect(view.result.current).toBeNull()
  expect(vi.getTimerCount()).toBe(0)
})
