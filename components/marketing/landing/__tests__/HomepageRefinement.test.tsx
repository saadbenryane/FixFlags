import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Footer } from '@/components/layout/footer'
import HowItWorksPage from '@/app/(marketing)/how-it-works/page'
import { PUBLIC_SITE_COPY as C } from '@/lib/marketing/copy/public-site'
import { FOOTER_COLUMNS } from '@/lib/site/nav'
import { MeProvider } from '@/hooks/useMe'

vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({ MarketingPageViewTracker: () => null }))

describe('published marketing journey', () => {
  it('offers one primary analysis action and one sample link in the explanation header', () => {
    const { container } = render(<MeProvider initialUser={null}><HowItWorksPage /></MeProvider>)
    const header = container.querySelector('header')!
    expect(within(header).getByRole('heading', { level: 1 })).toHaveTextContent(C.howItWorks.title)
    expect(within(header).getAllByRole('link')).toHaveLength(2)
    expect(within(header).getByRole('link', { name: C.analyze })).toHaveAttribute('href', '/new')
    expect(within(header).getByRole('link', { name: C.sample })).toHaveAttribute('href', '/samples')
  })
  it('renders the current footer destinations instead of testing unreachable compositions', () => {
    render(<Footer />)
    for (const link of Object.values(FOOTER_COLUMNS).flat()) expect(screen.getByRole('link', { name: link.label })).toHaveAttribute('href', link.href)
  })
})
