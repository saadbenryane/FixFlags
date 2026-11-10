import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SiteTopProblem, detectedBuilder, topProblem } from '../SiteTopProblem'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'

vi.mock('@/components/sites/SitePromptCopyButton', () => ({ SitePromptCopyButton: ({ flagTitle }: { flagTitle: string }) => <button type="button">Copy fix instructions for {flagTitle}</button> }))

const C = SITE_DASHBOARD_COPY.topProblem

function flag(overrides: Partial<SiteFlagSeed>): SiteFlagSeed {
  return {
    id: 'flag-1', improvementId: null, checkId: 'journey-checkout-failed', rubric: 'conversion', severity: 'IMPORTANT', impactTag: 'REVENUE',
    problem: 'Add to cart didn’t add the product', evidence: '', whyItMatters: '', fix: 'Fix the cart update.', pageUrl: 'https://shop.example/products/tote',
    status: 'OPEN', resolvedInId: null, area: 'conversion', affectedPaths: ['/products/tote'], affectedPageCount: 1, priorityBand: 'fix_first', priorityScore: 130,
    relatedOutcome: null, verificationState: 'open' as SiteFlagSeed['verificationState'], latestOccurrenceAt: '2026-11-10T09:00:00.000Z', ...overrides,
  }
}

describe('top problem', () => {
  it('picks the highest fix-first Flag and ignores lower bands', () => {
    const slow = flag({ id: 'slow', problem: 'Slow page', priorityScore: 104 })
    const cart = flag({ id: 'cart', priorityScore: 130 })
    const other = flag({ id: 'other', priorityBand: 'other', priorityScore: 200 })
    expect(topProblem([slow, other, cart])?.id).toBe('cart')
    expect(topProblem([other])).toBeNull()
  })

  it('detects an AI builder from the Site technologies', () => {
    expect(detectedBuilder([{ name: 'Next.js' }, { name: 'Lovable' }])?.slug).toBe('lovable')
    expect(detectedBuilder([{ name: 'Next.js' }])).toBeNull()
  })

  it('shows the Flag, its page, the copy action and a builder hint, and opens the Flag', () => {
    const onOpen = vi.fn()
    render(<SiteTopProblem siteId="site-1" flag={flag({})} copyAvailability="available" copyReady technologies={[{ name: 'Lovable' }]} onOpen={onOpen} />)
    expect(screen.getByRole('region', { name: 'Add to cart didn’t add the product' })).toBeVisible()
    expect(screen.getByText(C.label)).toBeVisible()
    expect(screen.getByText(C.page('/products/tote'))).toBeVisible()
    expect(screen.getByRole('button', { name: /Copy fix instructions/ })).toBeVisible()
    expect(screen.getByRole('link', { name: C.builderGuide('Lovable') })).toHaveAttribute('href', '/ai-builders/lovable')
    fireEvent.click(screen.getByRole('button', { name: C.view }))
    expect(onOpen).toHaveBeenCalledWith('flag-1', expect.any(HTMLElement))
  })

  it('hides the copy action until fix instructions are ready', () => {
    render(<SiteTopProblem siteId="site-1" flag={flag({ pageUrl: null })} copyAvailability="available" copyReady={false} technologies={[]} onOpen={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Copy fix instructions/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/^On /)).not.toBeInTheDocument()
  })
})
