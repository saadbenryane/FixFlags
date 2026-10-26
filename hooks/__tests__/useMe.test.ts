import { act, cleanup, renderHook } from '@testing-library/react'
import { createElement, type PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MeProvider, useMe } from '../useMe'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('session lookup recovery', () => {
  it('shares an in-flight claim with another claimant and session refresh without another request', async () => {
    let finishClaim!: (response: Response) => void
    const claim = new Promise<Response>(resolve => { finishClaim = resolve })
    const fetch = vi.fn(() => claim)
    vi.stubGlobal('fetch', fetch)
    const wrapper = ({ children }: PropsWithChildren) => createElement(MeProvider, { initialUser: null }, children)
    const { result } = renderHook(() => useMe({ load: false }), { wrapper })
    let first!: ReturnType<typeof result.current.claimAnonymous>
    let second!: ReturnType<typeof result.current.claimAnonymous>
    let refresh!: ReturnType<typeof result.current.refresh>
    await act(async () => {
      first = result.current.claimAnonymous()
      second = result.current.claimAnonymous()
      refresh = result.current.refresh()
    })
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/me/claim', { method: 'POST' })
    const claimed = { user: { id: 'owner', email: 'owner@example.test' }, claimedCount: 1 }
    await act(async () => { finishClaim(Response.json(claimed)); await Promise.all([first, second, refresh]) })
    expect(await first).toEqual(claimed)
    expect(await second).toEqual(claimed)
    expect(await refresh).toEqual(claimed)
    expect(result.current.user).toEqual(claimed.user)
  })

  it('retains a refused claim after an older lookup settles and admits an explicit retry', async () => {
    let finishLookup!: (response: Response) => void
    const lookup = new Promise<Response>(resolve => { finishLookup = resolve })
    const owner = { id: 'owner', email: 'owner@example.test' }
    const fetch = vi.fn().mockReturnValueOnce(lookup)
      .mockResolvedValueOnce(Response.json({ code: 'PROJECT_LIMIT' }, { status: 409 }))
      .mockResolvedValueOnce(Response.json({ user: owner, claimedCount: 1 }))
    vi.stubGlobal('fetch', fetch)
    const wrapper = ({ children }: PropsWithChildren) => createElement(MeProvider, null, children)
    const { result } = renderHook(() => useMe(), { wrapper })
    await act(async () => { await result.current.claimAnonymous() })
    expect(result.current.claimUpgrade?.kind).toBe('claim-limit')
    await act(async () => { finishLookup(Response.json({ user: null })) })
    expect(result.current.error).toBeTruthy()
    expect(result.current.claimUpgrade?.kind).toBe('claim-limit')
    await act(async () => { await result.current.claimAnonymous() })
    expect(result.current.user).toEqual(owner)
    expect(result.current.error).toBeNull()
    expect(result.current.claimUpgrade).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it.each([200, 503])('does not let an older session lookup overwrite a successful claim: %s', async status => {
    let finishLookup!: (response: Response) => void
    const lookup = new Promise<Response>(resolve => { finishLookup = resolve })
    const owner = { id: 'owner', email: 'owner@example.test' }
    vi.stubGlobal('fetch', vi.fn((url: string) => url === '/api/me' ? lookup : Promise.resolve(Response.json({ user: owner, claimedCount: 1 }))))
    const wrapper = ({ children }: PropsWithChildren) => createElement(MeProvider, null, children)
    const { result } = renderHook(() => useMe(), { wrapper })
    await act(async () => { await result.current.claimAnonymous() })
    expect(result.current.user).toEqual(owner)
    await act(async () => { finishLookup(Response.json({ user: null }, { status })) })
    expect(result.current.user).toEqual(owner)
    expect(result.current.claimedCount).toBe(1)
    expect(result.current.error).toBeNull()
  })

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
