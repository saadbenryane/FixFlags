import { describe, expect, it, vi } from 'vitest'
import { runPostLoginClaimFlow } from '@/hooks/post-login-claim-flow'

describe('runPostLoginClaimFlow', () => {
  it('lets the authorized claim finish without publishing a retired screen’s callbacks', async () => {
    const owner = new AbortController()
    let finish!: (value: { claimedCount: number }) => void
    const claim = vi.fn(() => new Promise<{ claimedCount: number }>(resolve => { finish = resolve }))
    const shouldEnroll = vi.fn(), showEnrollment = vi.fn(), beforeNavigate = vi.fn(), navigate = vi.fn()
    const pending = runPostLoginClaimFlow({ signal: owner.signal, claim, shouldEnroll, showEnrollment, beforeNavigate, navigate })
    owner.abort(); finish({ claimedCount: 1 })
    await expect(pending).resolves.toBe(false)
    expect(claim).toHaveBeenCalledOnce()
    expect(shouldEnroll).not.toHaveBeenCalled(); expect(showEnrollment).not.toHaveBeenCalled()
    expect(beforeNavigate).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled()
  })

  it('passes ownership into optional discovery and discards its late enrollment result', async () => {
    const owner = new AbortController()
    let finish!: (value: boolean) => void
    const shouldEnroll = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve }))
    const showEnrollment = vi.fn(), beforeNavigate = vi.fn(), navigate = vi.fn()
    const pending = runPostLoginClaimFlow({ signal: owner.signal, claim: async () => ({ claimedCount: 1 }), shouldEnroll, showEnrollment, beforeNavigate, navigate })
    await Promise.resolve()
    expect(shouldEnroll).toHaveBeenCalledExactlyOnceWith(owner.signal)
    owner.abort(); finish(true)
    await expect(pending).resolves.toBe(false)
    expect(showEnrollment).not.toHaveBeenCalled(); expect(beforeNavigate).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled()
  })

  it('gives the current handoff the validated claim receipt', async () => {
    const claimed = { claimedCount: 1, user: { id: 'claimed-owner', email: 'claimed@example.invalid' } }
    const beforeNavigate = vi.fn()
    await runPostLoginClaimFlow({ claim: async () => claimed, shouldEnroll: async () => false, showEnrollment: vi.fn(), beforeNavigate, navigate: async () => {} })
    expect(beforeNavigate).toHaveBeenCalledExactlyOnceWith(claimed)
  })

  it('completes an explicit destination after claiming without an optional enrollment interruption', async () => {
    const claim = vi.fn().mockResolvedValue({ claimedCount: 1 })
    const shouldEnroll = vi.fn().mockResolvedValue(true)
    const showEnrollment = vi.fn()
    const navigate = vi.fn().mockResolvedValue(undefined)
    await runPostLoginClaimFlow({
      claim,
      shouldEnroll,
      showEnrollment,
      beforeNavigate: vi.fn(),
      navigate,
      skipEnrollment: true,
    })
    expect(claim).toHaveBeenCalledOnce()
    expect(shouldEnroll).not.toHaveBeenCalled()
    expect(showEnrollment).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledOnce()
    expect(claim.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0])
  })

  it('does not navigate until claim has resolved successfully', async () => {
    let resolveClaim!: (value: object) => void
    const claim = new Promise<object>((resolve) => { resolveClaim = resolve })
    const navigate = vi.fn().mockResolvedValue(undefined)
    const flow = runPostLoginClaimFlow({
      claim: () => claim,
      shouldEnroll: async () => false,
      showEnrollment: vi.fn(),
      beforeNavigate: vi.fn(),
      navigate,
    })
    await Promise.resolve()
    expect(navigate).not.toHaveBeenCalled()
    resolveClaim({ claimedCount: 1 })
    await flow
    expect(navigate).toHaveBeenCalledOnce()
  })

  it('stays on post-login when claim fails', async () => {
    const navigate = vi.fn()
    const completed = await runPostLoginClaimFlow({
      claim: async () => null,
      shouldEnroll: async () => false,
      showEnrollment: vi.fn(),
      beforeNavigate: vi.fn(),
      navigate,
    })
    expect(completed).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('navigates when claim returns zero reports', async () => {
    const navigate = vi.fn().mockResolvedValue(undefined)
    const completed = await runPostLoginClaimFlow({
      claim: async () => ({ claimedCount: 0 }),
      shouldEnroll: async () => false,
      showEnrollment: vi.fn(),
      beforeNavigate: vi.fn(),
      navigate,
    })
    expect(completed).toBe(true)
    expect(navigate).toHaveBeenCalledOnce()
  })
})
