import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PricingRoute from '@/app/(marketing)/pricing/page'
import { PricingPage } from '@/components/pricing/PricingPage'
import { MeProvider } from '@/hooks/useMe'
import { PRICING } from '@/lib/marketing/copy/plans'
import { PRICING_ADD_ONS, PRICING_IMPACT, PRICING_PAGE_FAQ, PRICING_PLAN_TABLE, PRICING_STORY } from '@/lib/marketing/copy/pricing-page'

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
    expect(route).toMatch(/faqPageSchema\(PRICING_PAGE_FAQ/)
    expect(route).toMatch(/PricingPage/)
  })

  it('shows Free, Pro and Team as cards and Agency on its own row', () => {
    renderPricing()
    expect(screen.getByRole('heading', { level: 1, name: PRICING.headline })).toBeInTheDocument()
    expect(screen.getByText(PRICING.headlineAccent)).toBeVisible()
    const articles = screen.getAllByRole('article')
    expect(articles.map(card => within(card).getByRole('heading', { level: 3 }).textContent)).toEqual(['Free', 'Pro', 'Team', 'Agency'])
    const free = within(screen.getByRole('article', { name: 'Free' }))
    const pro = within(screen.getByRole('article', { name: 'Pro' }))
    const team = within(screen.getByRole('article', { name: 'Team' }))
    const agency = within(screen.getByRole('article', { name: 'Agency' }))
    expect(free.getByText('$0')).toBeVisible()
    expect(free.queryByText('Coming soon')).not.toBeInTheDocument()
    expect(free.getByRole('link', { name: 'Start free' })).toHaveAttribute('href', '/sign-up')
    expect(pro.getByText('$49')).toBeVisible()
    expect(pro.getByText('Daily checks')).toBeVisible()
    expect(pro.getByRole('link', { name: 'Join Pro waitlist' })).toHaveAttribute('href', '/waitlist/pro')
    expect(team.getByText('$149')).toBeVisible()
    expect(team.getByText('5 websites')).toBeVisible()
    expect(team.getByRole('link', { name: 'Join Team waitlist' })).toHaveAttribute('href', '/waitlist/team')
    expect(agency.getByText('$399')).toBeVisible()
    expect(agency.getByText('25 websites')).toBeVisible()
    expect(agency.getByText('Planned')).toBeVisible()
    expect(agency.getByRole('link', { name: 'Join Agency waitlist' })).toHaveAttribute('href', '/waitlist/agency')
    expect(free.getByText('Any check schedule')).toBeVisible()
    expect(free.getByText('A check after every deploy')).toBeVisible()
    expect(free.queryByText('Weekly checks')).not.toBeInTheDocument()
    for (const card of [pro, team, agency]) {
      expect(card.getByText('Coming soon')).toBeVisible()
      expect(card.getByText('Planned pricing')).toBeVisible()
    }
    expect(screen.queryByText('Studio')).not.toBeInTheDocument()
    expect(screen.queryByText('$99')).not.toBeInTheDocument()
    expect(document.body.innerHTML).not.toContain('/request-demo')
  })

  it('lists the add-ons and a plan table with honest statuses', () => {
    renderPricing()
    const addOns = within(screen.getByRole('region', { name: PRICING_ADD_ONS.title }))
    expect(addOns.getByText('$19')).toBeVisible()
    expect(addOns.getByText('a month each')).toBeVisible()
    expect(addOns.getByText('$29')).toBeVisible()
    expect(addOns.getByText('per 1,000')).toBeVisible()
    const planTable = screen.getByRole('table', { name: PRICING_PLAN_TABLE.caption })
    expect(within(planTable).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Feature', 'Free$0', 'Pro$49/month', 'Team$149/month', 'Agency$399/month'])
    const reports = within(within(planTable).getByRole('rowheader', { name: 'Client reports' }).closest('tr')!)
    expect(reports.getByText('Planned')).toBeVisible()
    expect(reports.getAllByText('Not included')).toHaveLength(3)
    const freeCell = (feature: string) => within(within(planTable).getByRole('rowheader', { name: feature }).closest('tr')!).getAllByRole('cell')[0]
    expect(freeCell('Scheduled checks')).toHaveTextContent('Any schedule')
    expect(within(freeCell('Check after every deploy')).getByText('Included')).toBeInTheDocument()
    expect(screen.getByText(PRICING_PLAN_TABLE.note)).toBeVisible()
  })

  it('tells the Check. Flag. Fix. Verify. story across the eight areas', () => {
    renderPricing()
    const story = within(screen.getByRole('region', { name: PRICING_STORY.title }))
    for (const area of ['Uptime', 'Pages', 'Conversion', 'Security', 'Performance', 'Search', 'Tracking', 'Accessibility']) expect(story.getByText(area)).toBeVisible()
    expect(PRICING_STORY.title).toBe('Check. Flag. Fix. Verify.')
    expect(story.getByRole('link', { name: PRICING_STORY.link.label })).toHaveAttribute('href', '/coverage')
    expect(story.getByRole('link', { name: PRICING_STORY.compareLink.label })).toHaveAttribute('href', '/compare')
  })

  it('drops the competitor table and unsourced tool claims', () => {
    renderPricing()
    expect(screen.queryByRole('table', { name: 'FixFlags compared with other website tools' })).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/AI fix prompt|npm CLI|UptimeRobot|Lovable Security Checker/)
  })

  it('cites every impact number at its source', () => {
    renderPricing()
    const impact = within(screen.getByRole('region', { name: PRICING_IMPACT.lines.join(' ') }))
    for (const stat of PRICING_IMPACT.stats) {
      expect(impact.getByText(stat.value)).toBeVisible()
      expect(impact.getByText(`“${stat.quote}”`)).toBeVisible()
      expect(impact.getByRole('link', { name: stat.source })).toHaveAttribute('href', stat.href)
    }
    expect(JSON.stringify(PRICING_IMPACT)).not.toMatch(/estimate|assum|illustrative/i)
    expect(PRICING_IMPACT).not.toHaveProperty('tieIn')
  })

  it('answers pricing questions with the new plans', () => {
    renderPricing()
    expect(screen.getByRole('button', { name: 'What do I get during open beta?' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Are Pro, Team and Agency available now?' })).toBeInTheDocument()
    expect(JSON.stringify(PRICING_PAGE_FAQ)).not.toMatch(/Studio|\$99|per website per month/)
    expect(JSON.stringify(PRICING_PAGE_FAQ)).not.toMatch(/\u2014/)
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
    expect(jsonLd?.textContent).toContain('Are Pro, Team and Agency available now?')
  })
})
