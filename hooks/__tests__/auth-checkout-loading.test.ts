import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAuthRedirect } from '../useAuthRedirect'

const moduleLoad = vi.hoisted(() => {
  let finish!: () => void
  const pending = new Promise<void>(resolve => { finish = resolve })
  return { pending, finish, checkout: vi.fn(), push: vi.fn(), replace: vi.fn(), error: vi.fn() }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: moduleLoad.push, replace: moduleLoad.replace }), useSearchParams: () => new URLSearchParams('plan=BUILDER') }))
vi.mock('sonner', () => ({ toast: { error: moduleLoad.error } }))
vi.mock('@/lib/billing/client-checkout', async () => {
  await moduleLoad.pending
  return { requestPlanCheckout: moduleLoad.checkout }
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it('recovers from a stalled checkout module and cannot start checkout when that module arrives late', async () => {
  vi.useFakeTimers()
  const { result } = renderHook(useAuthRedirect)
  let pending!: Promise<void>
  act(() => { pending = result.current.navigateAfterAuth() })
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(moduleLoad.error).toHaveBeenCalledOnce()
  expect(moduleLoad.push).toHaveBeenCalledExactlyOnceWith('/pricing')
  expect(moduleLoad.checkout).not.toHaveBeenCalled()
  await act(async () => { moduleLoad.finish(); await import('@/lib/billing/client-checkout'); await pending })
  expect(moduleLoad.checkout).not.toHaveBeenCalled()
  expect(moduleLoad.error).toHaveBeenCalledOnce()
})
