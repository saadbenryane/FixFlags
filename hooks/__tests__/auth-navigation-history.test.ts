import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const route = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), query: new URLSearchParams() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: route.push, replace: route.replace }), useSearchParams: () => route.query }))
import { useAuthRedirect } from '../useAuthRedirect'
beforeEach(() => { vi.clearAllMocks(); route.query = new URLSearchParams() })
describe('completed authentication navigation', () => {
  it('replaces its transient callback while preserving the exact selected Site destination', async () => {
    const destination = '/sites/anonymous-original?category=accessibility#evidence'
    route.query.set('next', destination)
    const { result } = renderHook(useAuthRedirect)
    await act(async () => { await result.current.navigateAfterAuth() })
    expect(route.replace).toHaveBeenCalledExactlyOnceWith(destination)
    expect(route.push).not.toHaveBeenCalled()
  })
  it('keeps unsafe destinations out of both navigation methods', async () => {
    route.query.set('next', '//another.example/')
    const { result } = renderHook(useAuthRedirect)
    await act(async () => { await result.current.navigateAfterAuth() })
    expect(route.replace).toHaveBeenCalledExactlyOnceWith('/dashboard')
    expect(route.push).not.toHaveBeenCalled()
  })
})
