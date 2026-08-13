import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { pickPlan, routerForPlanResult, type PickPlanInput } from '@/lib/billing/pick-plan'

vi.mock('@/lib/audit/active-audit', () => ({
  getActiveAudit: vi.fn(),
}))

vi.mock('@/lib/billing/client-checkout', () => ({
  requestPlanCheckout: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    message: vi.fn(),
    error: vi.fn(),
  },
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('pickPlan', () => {
  it('routes free plan to active report when available', async () => {
    const { getActiveAudit } = await import('@/lib/audit/active-audit')
    ;(getActiveAudit as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
      auditId: 'report-1',
    })

    await expect(
      pickPlan({
        plan: 'FREE',
        isLoggedIn: true,
      } as PickPlanInput)
    ).resolves.toEqual({ kind: 'free_report', url: '/report/report-1' })
  })

  it('routes free plan to report fallback path when no active report', async () => {
    const { getActiveAudit } = await import('@/lib/audit/active-audit')
    ;(getActiveAudit as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(null)

    await expect(
      pickPlan({
        plan: 'FREE',
        isLoggedIn: true,
        fallbackPath: '/report/xyz',
        respectActiveReport: false,
      } as PickPlanInput)
    ).resolves.toEqual({ kind: 'free_report', url: '/report/xyz' })
  })

  it('routes paid plan to dashboard when already on current plan', async () => {
    const { requestPlanCheckout } = await import('@/lib/billing/client-checkout')
    ;(requestPlanCheckout as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      kind: 'redirect',
      url: '/ignored',
      existingSubscription: false,
    })

    await expect(
      pickPlan({
        plan: 'BUILDER',
        isLoggedIn: true,
        currentPlan: 'BUILDER',
      } as PickPlanInput)
    ).resolves.toEqual({ kind: 'free_dashboard', url: '/dashboard' })

    expect(requestPlanCheckout).not.toHaveBeenCalled()
  })

  it('routes paid plan to waitlist when gated', async () => {
    const onPrivateBeta = vi.fn()

    const result = await pickPlan({
      plan: 'TEAM',
      isLoggedIn: false,
      waitlistGated: true,
      onPrivateBeta,
    } as PickPlanInput)

    expect(onPrivateBeta).toHaveBeenCalled()
    expect(result).toEqual({ kind: 'waitlist' })
  })

  it('builds checkout redirect branch and returns URL', async () => {
    const { requestPlanCheckout } = await import('@/lib/billing/client-checkout')
    ;(requestPlanCheckout as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      kind: 'redirect',
      url: 'https://checkout.example/plan',
      existingSubscription: false,
    })

    const onCheckoutRedirect = vi.fn()

    await expect(
      pickPlan({
        plan: 'TEAM',
        isLoggedIn: false,
        onCheckoutRedirect,
      } as PickPlanInput)
    ).resolves.toEqual({ kind: 'checkout_redirect', url: 'https://checkout.example/plan' })
    expect(onCheckoutRedirect).toHaveBeenCalledWith('https://checkout.example/plan')
  })

  it('surfaces unavailable when checkout is unavailable', async () => {
    const { requestPlanCheckout } = await import('@/lib/billing/client-checkout')
    ;(requestPlanCheckout as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      kind: 'unavailable',
      message: 'checkout unavailable',
    })

    await expect(
      pickPlan({
        plan: 'BUILDER',
        isLoggedIn: false,
      } as PickPlanInput)
    ).resolves.toEqual({ kind: 'unavailable', message: 'checkout unavailable' })
  })

  it('routes free plan to dashboard when no active report and no fallback', async () => {
    const { getActiveAudit } = await import('@/lib/audit/active-audit')
    ;(getActiveAudit as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(null)

    await expect(
      pickPlan({
        plan: 'FREE',
        isLoggedIn: true,
        respectActiveReport: true,
      } as PickPlanInput)
    ).resolves.toEqual({ kind: 'free_dashboard', url: '/dashboard' })
  })

  it('routes free plan to fallback dashboard when fallbackPath is not a report path', async () => {
    const { getActiveAudit } = await import('@/lib/audit/active-audit')
    ;(getActiveAudit as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(null)

    await expect(
      pickPlan({
        plan: 'FREE',
        isLoggedIn: true,
        fallbackPath: '/settings',
        respectActiveReport: true,
      } as PickPlanInput)
    ).resolves.toEqual({ kind: 'free_dashboard', url: '/settings' })
  })

  it('returns error when checkout returns error', async () => {
    const { requestPlanCheckout } = await import('@/lib/billing/client-checkout')
    ;(requestPlanCheckout as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      kind: 'error',
      message: 'checkout failed',
    })

    await expect(
      pickPlan({
        plan: 'BUILDER',
        isLoggedIn: false,
      } as PickPlanInput)
    ).resolves.toEqual({ kind: 'error', message: 'checkout failed' })
  })

  it('returns error when checkout returns missing-destination', async () => {
    const { requestPlanCheckout } = await import('@/lib/billing/client-checkout')
    ;(requestPlanCheckout as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      kind: 'missing-destination',
    })

    await expect(
      pickPlan({
        plan: 'TEAM',
        isLoggedIn: false,
      } as PickPlanInput)
    ).resolves.toMatchObject({ kind: 'error' })
  })

  it('routes to waitlist when checkout returns paid-checkout-closed', async () => {
    const { requestPlanCheckout } = await import('@/lib/billing/client-checkout')
    ;(requestPlanCheckout as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      kind: 'paid-checkout-closed',
    })
    const onPrivateBeta = vi.fn()

    await expect(
      pickPlan({
        plan: 'BUILDER',
        isLoggedIn: false,
        onPrivateBeta,
      } as PickPlanInput)
    ).resolves.toEqual({ kind: 'waitlist' })
    expect(onPrivateBeta).toHaveBeenCalled()
  })

  it('routes to waitlist with message when checkout returns batch gate error', async () => {
    const { requestPlanCheckout } = await import('@/lib/billing/client-checkout')
    ;(requestPlanCheckout as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      kind: 'error',
      message: 'paid checkout opens in batches',
    })
    const onPrivateBeta = vi.fn()

    await expect(
      pickPlan({
        plan: 'TEAM',
        isLoggedIn: false,
        onPrivateBeta,
      } as PickPlanInput)
    ).resolves.toEqual({ kind: 'waitlist', message: 'paid checkout opens in batches' })
    expect(onPrivateBeta).toHaveBeenCalled()
  })
})

describe('routerForPlanResult', () => {
  it('navigates only for dashboard/report routing results', () => {
    const push = vi.fn()
    const router = {
      push,
      replace: vi.fn(),
      prefetch: vi.fn(),
      refresh: vi.fn(),
      forward: vi.fn(),
      back: vi.fn(),
      currentPathname: '/x',
      pathname: '/x',
      refreshRoute: vi.fn(),
      ready: true,
      route: '/x',
    } as AppRouterInstance

    routerForPlanResult(router, { kind: 'free_report', url: '/report/abc' })
    expect(push).toHaveBeenCalledWith('/report/abc')

    routerForPlanResult(router, { kind: 'error', message: 'nope' })
    expect(push).toHaveBeenCalledTimes(1)
  })
})
