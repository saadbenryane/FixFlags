import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PricingRoute from '@/app/(marketing)/pricing/page'
import { PricingPage } from '@/components/pricing/PricingPage'
import { MeProvider } from '@/hooks/useMe'
import { PRICING } from '@/lib/marketing/copy/plans'
import { SITE_COMPARE } from '@/lib/marketing/copy/compare'

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
    expect(page).toMatch(/PricingComparisonTable/)
    expect(page).not.toMatch(/shopifyNote/)
    expect(page).toMatch(/MarketingCompareSection embedded/)
    expect(route).not.toMatch(/['"]use client['"]/)
    expect(route).toMatch(/faqPageSchema/)
    expect(route).toMatch(/PricingPage/)
  })

  it('renders plan cards and the monitoring headline immediately', () => {
    renderPricing()
    expect(screen.getByRole('heading', { level: 1, name: PRICING.headline })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Free' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('heading', { name: 'Pro' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Studio' })).toBeInTheDocument()
    expect(screen.getAllByText('$49').length).toBeGreaterThan(0)
    expect(screen.getByText(PRICING.studioCta)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /waitlist/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Compare plans' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: new RegExp(SITE_COMPARE.headlineDisplay) })).toBeInTheDocument()
  })

  it('compares monthly pricing, availability, and the shared fix workflow', () => {
    renderPricing()
    const table = within(screen.getByRole('table', { name: 'FixFlags plan comparison' }))
    const price = within(table.getByRole('row', { name: /Price/ }))
    expect(price.getByText('$0')).toBeInTheDocument()
    expect(price.getByText('$49 per website / month')).toBeInTheDocument()
    expect(price.getByText('Quoted per website')).toBeInTheDocument()
    const availability = within(table.getByRole('row', { name: /Availability/ }))
    expect(availability.getByText('Available now')).toBeInTheDocument()
    expect(availability.getAllByText('Join the waitlist')).toHaveLength(2)
    const monitoring = within(table.getByRole('row', { name: /Scheduled monitoring/ }))
    expect(monitoring.getByText('Weekly')).toBeInTheDocument()
    expect(monitoring.getByText('Every day')).toBeInTheDocument()
    for (const feature of ['Flags, evidence, and fix guidance', 'Verify after you publish', 'Connections']) {
      const row = within(table.getByRole('row', { name: new RegExp(feature) }))
      expect(row.getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Included', 'Included', 'Included'])
    }
    expect(screen.getByText(PRICING.compareNote)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: PRICING.coverageLink })).toHaveAttribute('href', '/docs/site-care')
    expect(screen.getByRole('link', { name: PRICING.connectionsLink })).toHaveAttribute('href', '/docs/integrations')
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
