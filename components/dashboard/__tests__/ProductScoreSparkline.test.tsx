import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProductScoreSparkline } from '@/components/dashboard/ProductScoreSparkline'

describe('ProductScoreSparkline', () => {
  it('plots chronological scores as a line', () => {
    const { container } = render(
      <ProductScoreSparkline
        productId="product-1"
        points={[
          { id: 'review-1', score: 64, at: '2026-08-01T00:00:00.000Z' },
          { id: 'review-2', score: 88, at: '2026-08-20T00:00:00.000Z' },
        ]}
      />,
    )

    expect(screen.getByRole('img', { name: 'Score trend 64 to 88' })).toBeInTheDocument()
    expect(container.querySelector('polyline')).toBeTruthy()
  })

  it('stays visible before the first completed score', () => {
    render(<ProductScoreSparkline productId="product-empty" points={[]} />)

    expect(screen.getByRole('img', { name: 'No completed scores yet' })).toBeInTheDocument()
  })
})
