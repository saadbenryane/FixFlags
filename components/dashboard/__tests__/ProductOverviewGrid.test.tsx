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
      severity: 'IMPORTANT',
    },
    latestManualReview: {
      id: 'review-alpha',
      kind: 'PRODUCT_REVIEW',
      status: 'COMPLETED',
      score: 82,
      reportCompleteness: 'FULL',
      unresolvedCount: 1,
      createdAt: '2026-08-13T00:00:00.000Z',
      completedAt: '2026-08-13T00:01:00.000Z',
      failureMessage: null,
    },
  },
  {
    id: 'product-beta',
    name: 'Beta',
    url: 'https://beta.example',
    purpose: null,
    watching: false,
    attentionCount: 0,
    topAttention: null,
    latestManualReview: {
      id: 'review-beta',
      kind: 'UPDATE_REVIEW',
      status: 'COMPLETED',
      score: 44,
      reportCompleteness: 'PARTIAL',
      unresolvedCount: 0,
      createdAt: '2026-08-12T00:00:00.000Z',
      completedAt: '2026-08-12T00:01:00.000Z',
      failureMessage: null,
    },
  },
]

describe('ProductOverviewGrid', () => {
  it('presents each Product as its own navigable evidence context', () => {
    const { container } = render(<ProductOverviewGrid products={products} />)

    expect(screen.getAllByRole('link', { name: /open product/i })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathname: '/products/product-alpha',
        }),
      ]),
    )
    expect(screen.getByText('Clarify the signup action')).toBeInTheDocument()
    expect(
      screen.getByText('0 open Improvements in the latest completed Review.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Alpha' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Beta' }),
    ).toBeInTheDocument()
    expect(screen.getByText('https://alpha.example')).toBeInTheDocument()
    expect(
      container.querySelector('.lucide-circle-alert'),
    ).not.toBeInTheDocument()
    expect(container.querySelector('.lucide-flag')).toBeInTheDocument()
    expect(screen.queryByText('-')).not.toBeInTheDocument()
    expect(
      screen.queryByText(/No independently verified/),
    ).not.toBeInTheDocument()
  })

  it('does not show success or a fake score while a Review is pending', () => {
    render(
      <ProductOverviewGrid
        products={[
          {
            ...products[1],
            latestManualReview: {
              ...products[1].latestManualReview!,
              status: 'CHECKING',
              score: null,
              completedAt: null,
            },
          },
        ]}
      />,
    )

    expect(screen.getByText('Checking evidence')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText(/Review in progress/)).toBeInTheDocument()
    expect(screen.queryByText(/0 open Improvements/)).not.toBeInTheDocument()
  })

  it('renders the empty Product state without inventing account activity', () => {
    render(<ProductOverviewGrid products={[]} />)

    const section = screen.getByRole('region', { name: 'Your Products' })
    expect(within(section).getByText('No Products yet')).toBeInTheDocument()
    expect(within(section).queryByText('Alpha')).not.toBeInTheDocument()
  })
})
