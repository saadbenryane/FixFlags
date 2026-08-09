import { describe, expect, it, vi } from 'vitest'
import { runPostLoginClaimFlow } from '@/hooks/post-login-claim-flow'

describe('runPostLoginClaimFlow', () => {
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
})
