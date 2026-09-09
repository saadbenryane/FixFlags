import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TextLink } from '@/components/ui/text-link'

describe('TextLink', () => {
  it('renders a real destination with the default link color', () => {
    render(<TextLink href="/help">Help Center</TextLink>)
    const link = screen.getByRole('link', { name: 'Help Center' })
    expect(link).toHaveAttribute('href', '/help')
    expect(link).toHaveClass('text-link')
  })

  it('uses brand color for marketing learn-more links', () => {
    render(
      <TextLink variant="brand" href="/help/billing-and-plans/free-vs-pro">
        Free vs Pro
      </TextLink>
    )
    const link = screen.getByRole('link', { name: 'Free vs Pro' })
    expect(link).toHaveAttribute('href', '/help/billing-and-plans/free-vs-pro')
    expect(link).toHaveClass('text-brand')
    expect(link).not.toHaveClass('text-link')
  })

  it('does not render a clickable link without an href', () => {
    render(<TextLink>Nowhere</TextLink>)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Nowhere').tagName).toBe('A')
    expect(screen.getByText('Nowhere')).not.toHaveAttribute('href')
  })
})
