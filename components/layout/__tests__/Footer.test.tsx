import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePathname } from 'next/navigation'
import { Footer } from '@/components/layout/footer'
import { BRAND } from '@/lib/marketing/copy'

vi.mock('next/image', () => ({
  default: ({
    alt,
    src,
  }: {
    alt: string
    src: string
  }) => <span role="img" aria-label={alt} data-src={src} />,
}))

vi.mock('next/navigation', () => ({ usePathname: vi.fn(() => '/pricing') }))

vi.mock('@/components/layout/FooterNewsletter', () => ({
  FooterNewsletter: () => <aside data-testid="footer-newsletter" />,
}))

vi.mock('@/components/layout/FooterThemeToggle', () => ({
  FooterThemeToggle: () => <button type="button">Toggle theme</button>,
}))

vi.mock('@/components/analytics/CookiePreferencesButton', () => ({
  CookiePreferencesButton: () => (
    <button type="button">Cookie settings</button>
  ),
}))

const LEGACY_TAGLINE =
  'FixFlags finds the website problems that matter, shows why they matter, and keeps watching.'
const LEGACY_MADE_WITH = 'Built for businesses that depend on their website.'

describe('Footer', () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue('/pricing')
  })

  it('renders the canonical brand tagline and category', () => {
    render(<Footer />)

    expect(screen.getByText(BRAND.tagline)).toBeInTheDocument()
    expect(screen.getByText(BRAND.category)).toBeInTheDocument()
  })

  it('keeps the newsletter section wired', () => {
    render(<Footer />)

    expect(screen.getByTestId('footer-newsletter')).toBeInTheDocument()
  })

  it('removes the competing newsletter conversion from the homepage only', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Footer />)

    expect(screen.queryByTestId('footer-newsletter')).not.toBeInTheDocument()
  })

  it('does not render legacy marketing copy', () => {
    render(<Footer />)

    expect(screen.queryByText(LEGACY_TAGLINE)).not.toBeInTheDocument()
    expect(screen.queryByText(LEGACY_MADE_WITH)).not.toBeInTheDocument()
  })
})
