import { render, screen, within } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Footer } from '@/components/layout/footer'
import { LandingFinalCtaSection } from '@/components/marketing/landing/LandingFinalCtaSection'
import { LandingHowItWorksSection } from '@/components/marketing/landing/LandingHowItWorksSection'
import { LandingLayersSection } from '@/components/marketing/landing/LandingLayersSection'
import { LandingProofSection } from '@/components/marketing/landing/LandingProofSection'

vi.mock('@/components/audit/AuditInput', () => ({
  AuditInput: () => <div data-testid="audit-input" />,
}))

beforeAll(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    },
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('homepage lean sections', () => {
  it('explains Observe, Verify, and Connect without invented percentages', () => {
    render(<LandingProofSection />)
    expect(
      screen.getByRole('heading', { name: /Evidence that gets smarter over time/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Observe' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Verify' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Connect' })).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('presents How it works as Check, Flag, Fix, Verify', () => {
    render(<LandingHowItWorksSection />)
    expect(
      screen.getByRole('heading', {
        name: /See the problem\. Fix it\. Know it works/,
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByRole('heading', { name: 'Check' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Flag' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Fix' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Verify' })).toBeInTheDocument()
  })

  it('explains Find, Understand, Fix, and Verify', () => {
    render(<LandingLayersSection />)
    expect(
      screen.getByRole('heading', { name: /Find\. Understand\. Fix\. Verify/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What deserves attention?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What happened, where, and why?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What should change next?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Did the change solve it?' })).toBeInTheDocument()
  })

  it('keeps the final CTA copy before the review evidence', () => {
    const { container } = render(<LandingFinalCtaSection />)
    const finalCta = container.querySelector('#final-cta')
    expect(finalCta).not.toBeNull()
    const heading = within(finalCta as HTMLElement).getByRole('heading', {
      name: /Enter your site\. See what matters first/,
    })
    const evidence = within(finalCta as HTMLElement).getByAltText(
      'A website review with evidence-backed Flags and an independent update review',
    )
    expect(
      Boolean(
        heading.compareDocumentPosition(evidence) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true)
  })

  it('keeps repeated assurances out of the final CTA and footer', () => {
    const { container } = render(
      <>
        <LandingFinalCtaSection />
        <Footer />
      </>,
    )
    const finalCta = container.querySelector('#final-cta')
    const footer = container.querySelector('footer')
    expect(finalCta).not.toBeNull()
    expect(footer).not.toBeNull()
    expect(
      within(finalCta as HTMLElement).queryByText('Evidence from your live site'),
    ).not.toBeInTheDocument()
    expect(
      within(footer as HTMLElement).queryByText('Fix prompt'),
    ).not.toBeInTheDocument()
  })
})
