import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PricingCTAButton } from '@/components/pricing/PricingCTAButton'
import { MeProvider } from '@/hooks/useMe'
import { BILLING_ACTION_COPY } from '@/lib/marketing/copy/plans'

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

  it('sends Studio clicks to the Studio waitlist', () => {
    push.mockReset()
    render(<MeProvider initialUser={null}><PricingCTAButton plan="TEAM" cta="Join Studio waitlist" signUpHref="/waitlist/studio" waitlistGated /></MeProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Join Studio waitlist' }))
    expect(push).toHaveBeenCalledWith('/waitlist/studio')
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

    fireEvent.click(screen.getByRole('button', { name: BILLING_ACTION_COPY.waitlist.submitPro }))
    expect(push).toHaveBeenCalledWith('/waitlist/pro')
  })
})
