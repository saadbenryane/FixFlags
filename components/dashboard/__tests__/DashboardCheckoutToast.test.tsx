import { act, cleanup, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DashboardCheckoutToast } from '../DashboardCheckoutToast'

const mocks = vi.hoisted(() => ({
  user: { id: 'owner-a' } as { id: string } | null,
  query: 'upgraded=1&plan=BUILDER&url=example.com',
  refresh: vi.fn(), replace: vi.fn(), push: vi.fn(), success: vi.fn(), message: vi.fn(), track: vi.fn(),
}))
const router = { replace: mocks.replace, push: mocks.push }
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams(mocks.query) }))
vi.mock('@/hooks/useMe', () => ({ useMe: () => ({ user: mocks.user, refresh: mocks.refresh }) }))
vi.mock('sonner', () => ({ toast: { success: mocks.success, message: mocks.message } }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: mocks.track }))

function account(overrides: Record<string, unknown> = {}) {
  return { user: { id: 'owner-a', plan: 'BUILDER', commercialPlan: 'BUILDER',
    effectiveEntitlements: { available: true, sources: ['SUBSCRIPTION'] }, ...overrides } }
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); mocks.user = { id: 'owner-a' }
  mocks.query = 'upgraded=1&plan=BUILDER&url=example.com'
  window.history.replaceState(null, '', '/dashboard?' + mocks.query)
  mocks.refresh.mockReset()
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it('waits for confirmed subscription access before announcing activation or recording the funnel event', async () => {
  let finish!: (value: ReturnType<typeof account>) => void
  mocks.refresh.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  render(<DashboardCheckoutToast />)
  expect(mocks.success).not.toHaveBeenCalled()
  expect(mocks.track).not.toHaveBeenCalled()
  await act(async () => { finish(account()) })
  expect(mocks.success).toHaveBeenCalledExactlyOnceWith('Your Pro plan is active.')
  expect(mocks.track).toHaveBeenCalledExactlyOnceWith('completed_checkout', { plan: 'BUILDER' })
  expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/dashboard?url=example.com', { scroll: false })
})

it.each([
  { commercialPlan: 'FREE', plan: 'BUILDER', effectiveEntitlements: { available: true, sources: ['OPEN_BETA'] } },
  { effectiveEntitlements: { available: true, sources: ['COMPLIMENTARY_ACCESS'] } },
  { effectiveEntitlements: { available: false, sources: ['SUBSCRIPTION'] } },
])('does not treat effective or unavailable access as subscription activation: %j', async state => {
  mocks.refresh.mockResolvedValue(account(state))
  render(<DashboardCheckoutToast />)
  await act(async () => { await vi.advanceTimersByTimeAsync(12_000) })
  expect(mocks.refresh).toHaveBeenCalledTimes(12)
  expect(mocks.success).not.toHaveBeenCalled()
  expect(mocks.track).not.toHaveBeenCalled()
  expect(mocks.message).toHaveBeenCalledOnce()
  expect(mocks.message.mock.calls[0][0]).toBe('Plan change not confirmed')
  expect(mocks.message.mock.calls[0][1].description).not.toMatch(/payment received/i)
})

it('recovers from an interrupted account read without leaving an unhandled rejection', async () => {
  mocks.refresh.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(account())
  render(<DashboardCheckoutToast />)
  await act(async () => { await vi.advanceTimersByTimeAsync(800) })
  expect(mocks.success).toHaveBeenCalledOnce()
  expect(mocks.refresh).toHaveBeenCalledTimes(2)
})

it('continues after effect replay and announces activation only once', async () => {
  mocks.refresh.mockResolvedValue(account())
  render(<StrictMode><DashboardCheckoutToast /></StrictMode>)
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(mocks.success).toHaveBeenCalledOnce()
  expect(mocks.track).toHaveBeenCalledOnce()
  expect(mocks.replace).toHaveBeenCalledOnce()
})

it.each(['unmount', 'account'] as const)('retires late account results after %s changes', async change => {
  let finish!: (value: ReturnType<typeof account>) => void
  mocks.refresh.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const page = render(<DashboardCheckoutToast />)
  if (change === 'account') { mocks.user = { id: 'owner-b' }; page.rerender(<DashboardCheckoutToast />) }
  else page.unmount()
  await act(async () => { finish(account()); await vi.advanceTimersByTimeAsync(12_000) })
  expect(mocks.success).not.toHaveBeenCalled()
  expect(mocks.message).not.toHaveBeenCalled()
  expect(mocks.track).not.toHaveBeenCalled()
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(mocks.refresh).toHaveBeenCalledOnce()
})

it('does not accept another account’s returned subscription state', async () => {
  mocks.refresh.mockResolvedValue(account({ id: 'owner-b' }))
  render(<DashboardCheckoutToast />)
  await act(async () => { await vi.advanceTimersByTimeAsync(12_000) })
  expect(mocks.success).not.toHaveBeenCalled()
  expect(mocks.message).not.toHaveBeenCalled()
  expect(mocks.track).not.toHaveBeenCalled()
})

it.each(['FREE', 'unknown', 'TEAM&plan=BUILDER'])('retires an invalid plan request without polling or fabricating a default: %s', plan => {
  mocks.query = `upgraded=1&plan=${plan}`
  render(<DashboardCheckoutToast />)
  expect(mocks.refresh).not.toHaveBeenCalled()
  expect(mocks.success).not.toHaveBeenCalled()
  expect(mocks.track).not.toHaveBeenCalled()
  expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/dashboard', { scroll: false })
})

it('keeps the polling cadence when the shared session refresh callback changes', async () => {
  mocks.refresh.mockResolvedValue(account({ commercialPlan: 'FREE' }))
  const page = render(<DashboardCheckoutToast />)
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  const first = mocks.refresh
  const next = vi.fn().mockResolvedValue(account())
  mocks.refresh = next
  page.rerender(<DashboardCheckoutToast />)
  expect(next).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(800) })
  expect(first).toHaveBeenCalledOnce()
  expect(next).toHaveBeenCalledOnce()
  expect(mocks.success).toHaveBeenCalledOnce()
})

it.each([
  ['upgraded=1&plan=BUILDER&url=example.com', '/dashboard?url=example.com#websites'],
  ['upgraded=1&plan=BUILDER', '/dashboard#websites'],
])('preserves the dashboard destination and reading position even if optional analytics fails: %s', async (query, destination) => {
  mocks.query = query
  window.history.replaceState(null, '', '/dashboard?' + mocks.query + '#websites')
  mocks.refresh.mockResolvedValue(account())
  mocks.track.mockImplementationOnce(() => { throw new Error('analytics unavailable') })
  render(<DashboardCheckoutToast />)
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(mocks.success).toHaveBeenCalledOnce()
  expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(destination, { scroll: false })
  expect(mocks.message).not.toHaveBeenCalled()
})
