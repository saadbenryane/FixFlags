import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  push: vi.fn(),
  searchParams: new URLSearchParams(),
}))

vi.mock('@/lib/auth-client', () => ({ authClient: { getSession: mocks.getSession } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => mocks.searchParams,
}))

import { useRedirectIfAuthenticated } from '@/hooks/useRedirectIfAuthenticated'

describe('useRedirectIfAuthenticated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Array.from(mocks.searchParams.keys())) mocks.searchParams.delete(key)
    mocks.getSession.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('routes a signed-in visitor through /post-login so the claim still runs', async () => {
    mocks.searchParams.set('next', '/sites/site-1/flags')
    renderHook(() => useRedirectIfAuthenticated())

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith('/post-login?next=%2Fsites%2Fsite-1%2Fflags')
    )
    expect(mocks.push).not.toHaveBeenCalledWith('/sites/site-1/flags')
  })

  it('carries the pricing intent through /post-login', async () => {
    mocks.searchParams.set('plan', 'BUILDER')
    renderHook(() => useRedirectIfAuthenticated())

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith('/post-login?plan=BUILDER')
    )
  })

  it('stays put when nobody is signed in', async () => {
    mocks.getSession.mockResolvedValue({ data: { user: null } })
    renderHook(() => useRedirectIfAuthenticated())

    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled())
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('does nothing for an overlay presentation', async () => {
    renderHook(() => useRedirectIfAuthenticated({ disabled: true }))
    await act(async () => {})

    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('keeps the form usable when the session check fails', async () => {
    mocks.getSession.mockRejectedValue(new Error('offline'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    renderHook(() => useRedirectIfAuthenticated())

    await waitFor(() => expect(warn).toHaveBeenCalled())
    expect(mocks.push).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
