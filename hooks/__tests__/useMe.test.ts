import { act, cleanup, renderHook } from '@testing-library/react'
import { createElement, type PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MeProvider, useMe } from '../useMe'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('session lookup recovery', () => {
  it('retains an unavailable result until an explicit retry instead of restarting from its own error update', async () => {
    const pending: ((response: Response) => void)[] = []
    const fetchSession = vi.fn(() => new Promise<Response>(resolve => pending.push(resolve)))
    vi.stubGlobal('fetch', fetchSession)
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    let showAdditionalConsumer = false
    function AdditionalConsumer() { useMe(); return null }
    const wrapper = ({ children }: PropsWithChildren) => createElement(MeProvider, null,
      children, showAdditionalConsumer ? createElement(AdditionalConsumer) : null)
    const { result, rerender } = renderHook(() => useMe(), { wrapper })
    expect(fetchSession).toHaveBeenCalledExactlyOnceWith('/api/me')

    await act(async () => { pending[0](new Response('{}', { status: 503 })) })
    expect(fetchSession).toHaveBeenCalledTimes(1)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeTruthy()

    showAdditionalConsumer = true
    rerender()
    expect(fetchSession).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBeTruthy()

    let retry!: ReturnType<typeof result.current.refresh>
    act(() => { retry = result.current.refresh() })
    expect(fetchSession).toHaveBeenCalledTimes(2)
    await act(async () => {
      pending[1](new Response(JSON.stringify({ user: null })))
      await retry
    })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(fetchSession).toHaveBeenCalledTimes(2)
  })
})
