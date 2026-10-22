import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PricingCTAButton } from '@/components/pricing/PricingCTAButton'
import { MeProvider } from '@/hooks/useMe'
import { BILLING_ACTION_COPY, PRICING_CARDS } from '@/lib/marketing/copy/plans'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/pricing',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/analytics/events', () => ({
  trackEvent: vi.fn(),
}))

describe('PricingCTAButton', () => {
  it('does not statically import the checkout planner into the first pricing paint', () => {
    const source = readFileSync(join(process.cwd(), 'components/pricing/PricingCTAButton.tsx'), 'utf8')
    expect(source).not.toMatch(/from ['"]@\/lib\/billing\/pick-plan['"]/)
    expect(source).toMatch(/import\(['"]@\/lib\/billing\/pick-plan['"]\)/)
  })

  it('keeps Start free usable for an existing Free account', async () => {
    push.mockReset()
    render(<MeProvider initialUser={null}><PricingCTAButton plan="FREE" cta="Start free" signUpHref="/new" isLoggedIn currentPlan="FREE" /></MeProvider>)
    const button = screen.getByRole('button', { name: 'Start free' })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'))
  })

  it('sends the public Free offer directly to sign up', () => {
    push.mockReset()
    const free = PRICING_CARDS[0]
    render(<MeProvider initialUser={null}><PricingCTAButton plan={free.plan} cta={free.cta} signUpHref={free.href} isLoggedIn={false} variant="brand" /></MeProvider>)
    expect(screen.getByRole('link', { name: 'Start free' })).toHaveAttribute('href', '/sign-up')
  })

  it('sends Studio clicks to the Studio waitlist', () => {
    push.mockReset()
    render(<MeProvider initialUser={null}><PricingCTAButton plan="TEAM" cta="Join Studio waitlist" signUpHref="/waitlist/studio" waitlistGated /></MeProvider>)
    expect(screen.getByRole('link', { name: 'Join Studio waitlist' })).toHaveAttribute('href', '/waitlist/studio')
  })

  it('sends gated Pro clicks to the waitlist without loading checkout', () => {
    push.mockReset()
    render(
      <MeProvider initialUser={null}>
        <PricingCTAButton
          plan="BUILDER"
          cta="Join waitlist"
          signUpHref="/waitlist/pro"
          highlight
          waitlistGated
        />
      </MeProvider>,
    )

    expect(screen.getByRole('link', { name: BILLING_ACTION_COPY.waitlist.submitPro })).toHaveAttribute('href', '/waitlist/pro')
  })
})
