import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { BILLING_PAGE_COPY, PRICING } from '@/lib/marketing/copy'

const trackEvent = vi.hoisted(() => vi.fn())
const useMe = vi.hoisted(() => vi.fn())
const useRouter = vi.hoisted(() => vi.fn())
const useSearchParams = vi.hoisted(() => vi.fn())
const getActiveAudit = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/useMe', () => ({ useMe }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent }))
vi.mock('@/lib/audit/active-audit', () => ({ getActiveAudit }))
vi.mock('next/navigation', () => ({
  useRouter: () => useRouter(),
  useSearchParams: () => useSearchParams(),
}))

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

import { BillingPlanActions } from '@/components/billing/BillingPlanActions'
import { BillingPlansSection } from '@/components/billing/BillingPlansSection'

describe('BillingPlanActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getActiveAudit.mockReturnValue(null)
    useMe.mockReturnValue({
      user: { id: 'u1', email: 'a@b.com', plan: 'FREE' },
      isLoading: false,
    })
    useSearchParams.mockReturnValue(new URLSearchParams())
    useRouter.mockReturnValue({ push: vi.fn(), replace: vi.fn() })
  })

  it('opens the plan picker modal from Upgrade plan', async () => {
    render(
      <BillingPlanActions
        isPaid={false}
        isActivating={false}
        hasStripeCustomer={false}
        showPlanPickerCta
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: BILLING_PAGE_COPY.upgradeCta }))

    expect(await screen.findByText(PRICING.pickerTitle)).toBeInTheDocument()
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith(
        'plan_picker_viewed',
        expect.objectContaining({ source: 'billing' }),
      ),
    )
  })
})

describe('BillingPlansSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getActiveAudit.mockReturnValue(null)
    useMe.mockReturnValue({
      user: { id: 'u1', email: 'a@b.com', plan: 'FREE' },
      isLoading: false,
    })
    useSearchParams.mockReturnValue(new URLSearchParams())
    useRouter.mockReturnValue({ push: vi.fn(), replace: vi.fn() })
  })

  it('shows all plans and opens the picker from a non-current plan CTA', async () => {
    render(<BillingPlansSection currentPlan="FREE" />)

    expect(screen.getByRole('heading', { name: BILLING_PAGE_COPY.plansTitle })).toBeInTheDocument()
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Studio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: PRICING.pickerCurrentPlan })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: BILLING_PAGE_COPY.upgradeCta }))
    expect(await screen.findByText(PRICING.pickerTitle)).toBeInTheDocument()
  })
})
