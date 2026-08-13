import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProductOverviewGrid } from '@/components/dashboard/ProductOverviewGrid'
import type { ProductOverviewDTO } from '@/lib/products/workspace'

const products: ProductOverviewDTO[] = [
  {
    id: 'product-alpha',
    name: 'Alpha',
    url: 'https://alpha.example',
    purpose: 'Help Alpha customers register',
    watching: true,
    attentionCount: 1,
    topAttention: {
      id: 'improvement-alpha',
      title: 'Clarify the signup action',
      status: 'READY_TO_VERIFY',
    },
    latestReview: {
      id: 'review-alpha',
      status: 'COMPLETED',
      score: 82,
      reportCompleteness: 'FULL',
      unresolvedCount: 1,
      createdAt: '2026-08-13T00:00:00.000Z',
      completedAt: '2026-08-13T00:01:00.000Z',
      failureMessage: null,
      isUpdateReview: false,
    },
    latestVerification: null,
  },
  {
    id: 'product-beta',
    name: 'Beta',
    url: 'https://beta.example',
    purpose: null,
    watching: false,
    attentionCount: 0,
    topAttention: null,
    latestReview: {
      id: 'review-beta',
      status: 'COMPLETED',
      score: 44,
      reportCompleteness: 'PARTIAL',
      unresolvedCount: 0,
      createdAt: '2026-08-12T00:00:00.000Z',
      completedAt: '2026-08-12T00:01:00.000Z',
      failureMessage: null,
      isUpdateReview: true,
    },
    latestVerification: {
      outcome: 'INCONCLUSIVE',
      improvementTitle: 'Restore checkout',
      verificationReviewId: 'review-beta',
    },
  },
]

describe('ProductOverviewGrid', () => {
  it('presents each Product as its own navigable evidence context', () => {
    render(<ProductOverviewGrid products={products} />)

    expect(screen.getAllByRole('link', { name: /open product/i })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathname: '/products/product-alpha',
        }),
      ])
    )
    expect(screen.getByText('Clarify the signup action')).toBeInTheDocument()
    expect(screen.getByText(/Latest verification: inconclusive/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Alpha' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Beta' })).toBeInTheDocument()
  })

  it('renders the empty Product state without inventing account activity', () => {
    render(<ProductOverviewGrid products={[]} />)

    const section = screen.getByRole('region', { name: 'Your Products' })
    expect(within(section).getByText('No Products yet')).toBeInTheDocument()
    expect(within(section).queryByText('Alpha')).not.toBeInTheDocument()
  })
})
