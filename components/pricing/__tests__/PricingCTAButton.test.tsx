import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
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
