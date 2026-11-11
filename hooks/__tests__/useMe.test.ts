import { act, cleanup, renderHook } from '@testing-library/react'
import { createElement, type PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MeProvider, useMe, type MeUser } from '../useMe'
import { AUTH } from '@/lib/marketing/copy/auth'
import { CLIENT_REQUEST_TIMEOUT_MS } from '@/lib/api/client-request'
import { trackEvent } from '@/lib/analytics/events'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

function account(): MeUser {
  return { id: 'owner', email: 'owner@example.test', name: 'Owner', plan: 'FREE', role: 'user', isAdmin: false,
    checks: { used: 0, pending: 0, limit: 5, isUnlimited: false, remaining: 5,
      periodStart: '2026-11-01T00:00:00Z', periodEnd: '2026-12-01T00:00:00Z' },
    entitlements: { canExportSummary: true, canAccessPaidFeatures: false, canMonitor: true, canWatchProduct: true },
    vibecodingLevel: null, preferredTools: [] }
}

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
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/me/claim', expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) }))
    const claimed = { user: account(), claimedCount: 1 }
    await act(async () => { finishClaim(Response.json(claimed)); await Promise.all([first, second, refresh]) })
    expect(await first).toEqual(claimed)
    expect(await second).toEqual(claimed)
    expect(await refresh).toEqual(claimed)
    expect(result.current.user).toEqual(claimed.user)
  })

  it('retains a refused claim after an older lookup settles and admits an explicit retry', async () => {
    let finishLookup!: (response: Response) => void
    const lookup = new Promise<Response>(resolve => { finishLookup = resolve })
    const owner = account()
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
    const owner = account()
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
    expect(fetchSession).toHaveBeenCalledExactlyOnceWith('/api/me', expect.objectContaining({ signal: expect.any(AbortSignal) }))

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
    expect(fetchSession).toHaveBeenLastCalledWith('/api/me', expect.objectContaining({ cache: 'no-store' }))
    await act(async () => {
      pending[1](new Response(JSON.stringify({ user: null })))
      await retry
    })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(fetchSession).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['lookup', 'headers'], ['lookup', 'body'], ['claim', 'headers'], ['claim', 'body'],
  ] as const)('bounds %s through stalled %s, retains the account, and allows an explicit retry', async (kind, stage) => {
    vi.useFakeTimers()
    const owner = account(), recovered = { ...owner, name: 'Recovered owner' }
    let signal!: AbortSignal
    let finish!: (body: unknown) => void
    const fetcher = vi.fn().mockImplementationOnce((_url, options) => {
      signal = options.signal
      if (stage === 'headers') return new Promise<Response>(resolve => { finish = body => resolve(Response.json(body)) })
      return Promise.resolve({ ok: true, json: () => new Promise(resolve => { finish = resolve }) } as Response)
    }).mockImplementation(async () => Response.json(kind === 'claim' ? { user: recovered, claimedCount: 1 } : { user: recovered }))
    vi.stubGlobal('fetch', fetcher)
    const wrapper = ({ children }: PropsWithChildren) => createElement(MeProvider, { initialUser: owner }, children)
    const { result, unmount } = renderHook(() => useMe({ load: false }), { wrapper })
    try {
      let settled = false
      let pending!: Promise<unknown>
      act(() => { pending = (kind === 'claim' ? result.current.claimAnonymous() : result.current.refresh()).then(value => { settled = true; return value }) })
      await act(async () => { await vi.advanceTimersByTimeAsync(CLIENT_REQUEST_TIMEOUT_MS - 1) })
      expect(settled).toBe(false)
      expect(result.current.isLoading).toBe(true)
      await act(async () => { await vi.advanceTimersByTimeAsync(1); expect(await pending).toBeNull() })
      expect(signal.aborted).toBe(true)
      expect(result.current.user).toEqual(owner)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(kind === 'claim' ? AUTH.me.claimError : AUTH.me.loadError)
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
      expect(fetcher).toHaveBeenCalledTimes(1)
      await act(async () => { await (kind === 'claim' ? result.current.claimAnonymous() : result.current.refresh()) })
      expect(result.current.user).toEqual(recovered)
      expect(result.current.error).toBeNull()
      await act(async () => { finish({ user: { ...owner, id: 'late-owner' }, claimedCount: 99 }); await vi.advanceTimersByTimeAsync(0) })
      expect(result.current.user).toEqual(recovered)
      expect(fetcher).toHaveBeenCalledTimes(2)
      expect(vi.getTimerCount()).toBe(0)
    } finally { unmount(); vi.useRealTimers() }
  })

  it('retains a known account after a malformed lookup but accepts an explicit signed-out response', async () => {
    const owner = account()
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(Response.json({ user: null }))
    vi.stubGlobal('fetch', fetcher)
    const wrapper = ({ children }: PropsWithChildren) => createElement(MeProvider, { initialUser: owner }, children)
    const { result } = renderHook(() => useMe({ load: false }), { wrapper })
    await act(async () => { expect(await result.current.refresh()).toBeNull() })
    expect(result.current.user).toEqual(owner)
    expect(result.current.error).toBe(AUTH.me.loadError)
    await act(async () => { await result.current.refresh() })
    expect(result.current.user).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it.each([
    ['a missing claim count', { user: account() }],
    ['an incomplete account', { user: { id: 'owner', email: 'owner@example.test' }, claimedCount: 1 }],
  ])('does not celebrate a claim with %s', async (_facts, body) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(body)))
    const owner = account()
    const wrapper = ({ children }: PropsWithChildren) => createElement(MeProvider, { initialUser: owner }, children)
    const { result } = renderHook(() => useMe({ load: false }), { wrapper })
    await act(async () => { expect(await result.current.claimAnonymous()).toBeNull() })
    expect(result.current.user).toEqual(owner)
    expect(result.current.claimedCount).toBeNull()
    expect(result.current.error).toBe(AUTH.me.claimError)
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('keeps an accepted claim successful when optional analytics fails', async () => {
    const claimed = { user: account(), claimedCount: 1 }
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(claimed)))
    vi.mocked(trackEvent).mockImplementationOnce(() => { throw new Error('Optional analytics unavailable') })
    const wrapper = ({ children }: PropsWithChildren) => createElement(MeProvider, { initialUser: null }, children)
    const { result } = renderHook(() => useMe({ load: false }), { wrapper })
    await act(async () => { expect(await result.current.claimAnonymous()).toEqual(claimed) })
    expect(result.current.user).toEqual(claimed.user)
    expect(result.current.claimedCount).toBe(1)
    expect(result.current.error).toBeNull()
  })
})
