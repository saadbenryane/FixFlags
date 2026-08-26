import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UsageMeter } from '@/components/dashboard/UsageMeter'

describe('UsageMeter', () => {
  it('renders a compact remaining count instead of a full-height card', () => {
    const { container } = render(
      <UsageMeter variant="compact" used={1} limit={3} pending={0} plan="FREE" />,
    )

    expect(
      screen.getByRole('region', { name: 'Product review usage' }),
    ).toBeInTheDocument()
    expect(screen.getByText('2 remaining')).toBeInTheDocument()
    expect(screen.getByText('Update reviews use the same credits.')).toBeInTheDocument()
    expect(container.querySelector('.text-3xl')).toBeNull()
  })

  it('keeps the detailed remaining count for billing', () => {
    render(<UsageMeter used={2} limit={5} pending={0} plan="BUILDER" />)

    expect(screen.getByText('Product review usage')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('product reviews remaining')).toBeInTheDocument()
  })
})
