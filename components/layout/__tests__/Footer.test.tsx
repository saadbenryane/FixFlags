import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
  it('renders the canonical footer description and category', () => {
    render(<Footer />)

    expect(screen.getByText(BRAND.footerDescription)).toBeInTheDocument()
    expect(screen.getByText(BRAND.category)).toBeInTheDocument()
    expect(screen.getByText(BRAND.trademarkNotice)).toBeInTheDocument()
  })

  it('does not render a newsletter signup', () => {
    render(<Footer />)
    expect(screen.queryByText('Stay in the loop')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Email address' })).not.toBeInTheDocument()
  })

  it('does not render legacy marketing copy', () => {
    render(<Footer />)

    expect(screen.queryByText(LEGACY_TAGLINE)).not.toBeInTheDocument()
    expect(screen.queryByText(LEGACY_MADE_WITH)).not.toBeInTheDocument()
  })
})
