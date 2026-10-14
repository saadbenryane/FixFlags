import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, within } from '@testing-library/react'
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
    expect(page).toMatch(/PricingComparisonTable/)
    expect(page).not.toMatch(/shopifyNote/)
    expect(page).not.toMatch(/MarketingCompareSection/)
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
    expect(screen.getByText(PRICING.headlineAccent)).toBeVisible()
    expect(within(screen.getByRole('article', { name: 'Free' })).getByRole('link', { name: 'Sign up now' })).toHaveAttribute('href', '/sign-up')
    expect(screen.getByRole('link', { name: 'Join Pro waitlist' })).toHaveAttribute('href', '/waitlist/pro')
    expect(screen.getByRole('link', { name: 'Join Studio waitlist' })).toHaveAttribute('href', '/waitlist/studio')
    expect(screen.getAllByText('$99').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.getAllByRole('article').filter(card => within(card).queryByText('Coming soon'))).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Compare plans' })).toBeInTheDocument()
  })

  it('combines plan choices, scheduling, and actions without a second comparison', () => {
    renderPricing()
    const free = within(screen.getByRole('article', { name: 'Free' }))
    const pro = within(screen.getByRole('article', { name: 'Pro' }))
    const studio = within(screen.getByRole('article', { name: 'Studio' }))
    expect(free.getByText('$0')).toBeVisible()
    expect(free.getByText('Open beta')).toBeVisible()
    expect(free.getByText('Custom')).toBeVisible()
    expect(free.getByText('No usage limits')).toBeVisible()
    expect(pro.getByText('$49')).toBeVisible()
    expect(pro.getByText('30 / month')).toBeVisible()
    expect(pro.getByText('Custom')).toBeVisible()
    expect(pro.getByText('Planned pricing')).toBeVisible()
    expect(pro.getByRole('link', { name: 'Join Pro waitlist' })).toBeVisible()
    expect(studio.getByText('$99')).toBeVisible()
    expect(studio.getByText('90 / month')).toBeVisible()
    expect(studio.getByText('Custom')).toBeVisible()
    expect(studio.getByText('Requires a connected integration')).toBeVisible()
    expect(studio.getByText('Planned')).toBeVisible()
    expect(studio.getByRole('link', { name: 'Join Studio waitlist' })).toBeVisible()
    for (const plan of [free, pro, studio]) {
      expect(plan.getByText('Uptime monitoring')).toBeVisible()
      expect(plan.getByText('Included')).toBeVisible()
    }
    for (const feature of PRICING.sharedFeatures) expect(screen.getByText(feature)).toBeVisible()
    expect(screen.queryByText('Browser verification')).not.toBeInTheDocument()
    expect(screen.queryByText('See all plan terms')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText(PRICING.compareNote)).not.toBeInTheDocument()
    expect(screen.queryByText(PRICING.studioLine)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'What do I get during open beta?' })).toHaveAttribute('aria-expanded', 'false')
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
