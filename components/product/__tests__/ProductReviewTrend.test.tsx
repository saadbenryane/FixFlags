import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProductReviewTrend } from '@/components/product/ProductReviewTrend'
import type { ProductReviewSummaryDTO } from '@/lib/products/workspace'

function review(
  id: string,
  score: number,
  completedAt: string,
): ProductReviewSummaryDTO {
  return {
    id,
    kind: id === 'review-2' ? 'UPDATE_REVIEW' : 'PRODUCT_REVIEW',
    status: 'COMPLETED',
    score,
    reportCompleteness: 'FULL',
    unresolvedCount: 1,
    coverageLabel: null,
    createdAt: completedAt,
    completedAt,
    failureMessage: null,
  }
}

describe('ProductReviewTrend', () => {
  it('plots every completed score as a link to its Review', () => {
    render(
      <ProductReviewTrend
        reviews={[
          review('review-2', 82, '2026-08-20T00:00:00.000Z'),
          review('review-1', 64, '2026-08-10T00:00:00.000Z'),
        ]}
      />,
    )

    expect(screen.getByText('64 → 82')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /score point 1 of 2/i })).toHaveAttribute(
      'href',
      '/report/review-1?view=report',
    )
    expect(screen.getByRole('link', { name: /score point 2 of 2/i })).toHaveAttribute(
      'href',
      '/report/review-2?view=report',
    )
    expect(screen.queryByText(/open any point/i)).not.toBeInTheDocument()
  })

  it('keeps the chart visible before the first Review', () => {
    render(<ProductReviewTrend reviews={[]} />)

    expect(screen.getByLabelText('Review score trend')).toBeInTheDocument()
    expect(
      screen.getByText(/score trend will appear after the first completed Review/i),
    ).toBeInTheDocument()
  })
})
