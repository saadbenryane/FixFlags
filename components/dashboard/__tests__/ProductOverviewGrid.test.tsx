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
      coverageLabel: null,
      createdAt: '2026-08-13T00:00:00.000Z',
      completedAt: '2026-08-13T00:01:00.000Z',
      failureMessage: null,
    },
    desktopScreenshotUrl: '/api/screenshots/review-alpha/desktop',
    scoreHistory: [
      { id: 'review-alpha-earlier', score: 70, at: '2026-08-01T00:00:00.000Z' },
      { id: 'review-alpha', score: 82, at: '2026-08-13T00:01:00.000Z' },
    ],
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
      coverageLabel: null,
      createdAt: '2026-08-12T00:00:00.000Z',
      completedAt: '2026-08-12T00:01:00.000Z',
      failureMessage: null,
    },
    desktopScreenshotUrl: null,
    scoreHistory: [
      { id: 'review-beta', score: 44, at: '2026-08-12T00:01:00.000Z' },
    ],
  },
]

describe('ProductOverviewGrid', () => {
  it('presents each Site as a board link', () => {
    const { container } = render(<ProductOverviewGrid products={products} />)

    expect(screen.getByRole('link', { name: /open site alpha/i })).toHaveAttribute(
      'href',
      '/sites/product-alpha'
    )
    expect(screen.getByRole('link', { name: /open site beta/i })).toHaveAttribute(
      'href',
      '/sites/product-beta'
    )
    expect(screen.getByText('Clarify the signup action')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Alpha' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Beta' }),
    ).toBeInTheDocument()
    expect(screen.getByText('alpha.example')).toBeInTheDocument()
    expect(
      container.querySelector('img[src="/api/screenshots/review-alpha/desktop"]'),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /score trend 70 to 82/i }),
    ).toBeInTheDocument()
  })

  it('does not show success or a fake score while a check is pending', () => {
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
    expect(screen.getByText(/Check in progress/)).toBeInTheDocument()
  })

  it('offers a first website check when the account has no Sites', () => {
    render(<ProductOverviewGrid products={[]} />)

    const section = screen.getByRole('region', { name: 'Your Sites' })
    expect(within(section).getByText('0 Sites')).toBeInTheDocument()
    expect(within(section).getByText('Check your first website')).toBeInTheDocument()
    expect(
      within(section).getByRole('link', { name: 'Check a website URL' }),
    ).toHaveAttribute('href', '/new')
  })
})
