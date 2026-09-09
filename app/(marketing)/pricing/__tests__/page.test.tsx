import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PricingRoute from '@/app/(marketing)/pricing/page'
import { PricingPage } from '@/components/pricing/PricingPage'
import { MeProvider } from '@/hooks/useMe'
import { PRICING } from '@/lib/marketing/copy/plans'

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt?: string; src: string }) => (
    <span role="img" aria-label={alt || 'pricing visual'} data-src={src} />
  ),
}))

vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({
  MarketingPageViewTracker: () => null,
}))

vi.mock('@/lib/analytics/events', () => ({
  trackEvent: vi.fn(),
}))

function renderPricing() {
  return render(
    <MeProvider initialUser={null}>
      <PricingPage />
    </MeProvider>,
  )
}

describe('/pricing', () => {
  it('keeps the public page a server component without session fetches', () => {
    const page = readFileSync(join(process.cwd(), 'components/pricing/PricingPage.tsx'), 'utf8')
    const route = readFileSync(join(process.cwd(), 'app/(marketing)/pricing/page.tsx'), 'utf8')
    expect(page).not.toMatch(/['"]use client['"]/)
    expect(page).not.toMatch(/useMe/)
    expect(route).not.toMatch(/['"]use client['"]/)
    expect(route).toMatch(/faqPageSchema/)
    expect(route).toMatch(/PricingPage/)
  })

  it('renders plan cards and the monitoring headline immediately', () => {
    renderPricing()
    expect(screen.getByRole('heading', { level: 1, name: PRICING.headline })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Free' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('heading', { name: 'Pro' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('heading', { name: 'Studio' }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('$49').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Volume').length).toBeGreaterThan(0)
  })

  it('embeds FAQPage structured data on the route', () => {
    const { container } = render(
      <MeProvider initialUser={null}>
        <PricingRoute />
      </MeProvider>,
    )
    const jsonLd = container.querySelector('script[type="application/ld+json"]')
    expect(jsonLd?.textContent).toContain('FAQPage')
    expect(jsonLd?.textContent).toContain('/pricing')
  })
})
