import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const trackEvent = vi.hoisted(() => vi.fn())
const useMe = vi.hoisted(() => vi.fn())
const useRouter = vi.hoisted(() => vi.fn())
const useSearchParams = vi.hoisted(() => vi.fn())
const requestPlanCheckout = vi.hoisted(() => vi.fn())
const getActiveAudit = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/useMe', () => ({ useMe }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent }))
vi.mock('@/lib/audit/active-audit', () => ({ getActiveAudit }))
vi.mock('@/lib/billing/client-checkout', () => ({
  requestPlanCheckout: (...args: unknown[]) => requestPlanCheckout(...args),
}))
vi.mock('next/navigation', () => ({ useRouter: () => useRouter(), useSearchParams: () => useSearchParams() }))

beforeAll(() => {
  if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  }
})

import { PlanPickerDialog } from '@/components/billing/PlanPickerDialog'

function visibleClose() {
  const candidates = screen.queryAllByRole('button', { name: 'Close' })
  const visible = candidates.find((el) => !el.hasAttribute('data-radix-focus-guard'))
  if (!visible) {
    const span = screen.getByText('Close', { selector: 'span.sr-only' })
    const button = span.closest('button')
    if (button) return button
  }
  return visible ?? candidates[0]
}

describe('PlanPickerDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requestPlanCheckout.mockResolvedValue({ kind: 'missing-destination' })
    getActiveAudit.mockReturnValue(null)
    useMe.mockReturnValue({ user: null, isLoading: false })
    useSearchParams.mockReturnValue(new URLSearchParams())
    useRouter.mockReturnValue({ push: vi.fn(), replace: vi.fn() })
  })

  it('renders three plans and tracks a view', async () => {
    useMe.mockReturnValue({
      user: { id: 'u1', email: 'a@b.com', plan: 'FREE' },
      isLoading: false,
    })

    render(
      <PlanPickerDialog open onOpenChange={() => {}} source="post_signin" />
    )

    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Studio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Current plan' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join Pro waitlist' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join Studio waitlist' })).toBeInTheDocument()
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith(
        'plan_picker_viewed',
        expect.objectContaining({ source: 'post_signin' })
      )
    )
  })

  it('marks the current plan and disables its CTA', () => {
    useMe.mockReturnValue({
      user: { id: 'u1', email: 'a@b.com', plan: 'BUILDER' },
      isLoading: false,
    })

    render(
      <PlanPickerDialog open onOpenChange={() => {}} source="post_signin" />
    )

    const currentButton = screen.getByRole('button', { name: 'Current plan' })
    expect(currentButton).toBeDisabled()
  })

  it('returns the user to the active report when they pick Free', async () => {
    useMe.mockReturnValue({
      user: { id: 'u1', email: 'a@b.com', plan: 'TEAM' },
      isLoading: false,
    })
    getActiveAudit.mockReturnValue({ auditId: 'audit-1', url: 'https://example.com' })

    const push = vi.fn()
    useRouter.mockReturnValue({ push, replace: vi.fn() })
    const onOpenChange = vi.fn()

    render(
      <PlanPickerDialog open onOpenChange={onOpenChange} source="post_signin" />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start free' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/report/audit-1'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(trackEvent).toHaveBeenCalledWith(
      'plan_picker_picked',
      expect.objectContaining({ plan: 'FREE' })
    )
  })

  it('routes to dashboard when Free is picked without a pending report', async () => {
    useMe.mockReturnValue({
      user: { id: 'u1', email: 'a@b.com', plan: 'TEAM' },
      isLoading: false,
    })
    const push = vi.fn()
    useRouter.mockReturnValue({ push, replace: vi.fn() })

    render(
      <PlanPickerDialog open onOpenChange={() => {}} source="post_signin" />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start free' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'))
  })

  it('tracks dismissal when the dialog closes', () => {
    useMe.mockReturnValue({
      user: { id: 'u1', email: 'a@b.com', plan: 'FREE' },
      isLoading: false,
    })

    const onOpenChange = vi.fn()
    render(
      <PlanPickerDialog open onOpenChange={onOpenChange} source="post_signin" />
    )

    fireEvent.click(visibleClose())

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(trackEvent).toHaveBeenCalledWith('plan_picker_dismissed', { source: 'post_signin' })
  })
})
