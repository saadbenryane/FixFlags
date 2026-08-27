import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProductReviewSummaryDTO } from '@/lib/products/workspace'

const routerPush = vi.hoisted(() => vi.fn())
const startScanWithHandoff = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}))

vi.mock('@/lib/audit/start-scan-handoff', () => ({
  startScanWithHandoff,
}))

vi.mock('@/components/audit/AuditInput', () => ({
  AuditInput: ({ initialUrl }: { initialUrl: string }) => (
    <div aria-label="Product Review input" data-url={initialUrl} />
  ),
}))

vi.mock('@/lib/analytics/events', () => ({
  trackEvent: vi.fn(),
}))

import { ProductReviewAction } from '@/components/product/ProductReviewAction'

const completedReview: ProductReviewSummaryDTO = {
  id: 'review-completed',
  kind: 'PRODUCT_REVIEW',
  status: 'COMPLETED',
  score: 81,
  reportCompleteness: 'FULL',
  unresolvedCount: 1,
  coverageLabel: null,
  createdAt: '2026-08-12T00:00:00.000Z',
  completedAt: '2026-08-12T00:01:00.000Z',
  failureMessage: null,
}

afterEach(() => {
  routerPush.mockReset()
  startScanWithHandoff.mockReset()
})

describe('ProductReviewAction', () => {
  it('opens an active manual Product Review in Report', () => {
    const activeManualReview: ProductReviewSummaryDTO = {
      ...completedReview,
      id: 'review-active',
      status: 'CHECKING',
      score: null,
      reportCompleteness: 'UNKNOWN',
      completedAt: null,
      kind: 'UPDATE_REVIEW',
    }

    render(
      <ProductReviewAction
        productUrl="https://example.com"
        activeManualReview={activeManualReview}
        latestManualReview={activeManualReview}
        latestCompletedManualReview={completedReview}
      />,
    )

    expect(
      screen.getByRole('link', { name: /open review/i }),
    ).toHaveAttribute('href', '/report/review-active?view=report')
    expect(
      screen.queryByRole('button', { name: /update review/i }),
    ).not.toBeInTheDocument()
  })

  it('uses the first-Review input when the Product has no completed baseline', () => {
    render(
      <ProductReviewAction
        productUrl="https://example.com"
        activeManualReview={null}
        latestManualReview={null}
        latestCompletedManualReview={null}
      />,
    )

    expect(screen.getByText('Start Product Review')).toBeInTheDocument()
    expect(screen.getByLabelText('Product Review input')).toHaveAttribute(
      'data-url',
      'https://example.com',
    )
  })

  it('offers a fresh first Product Review after a failed Review without a baseline', () => {
    const failedReview: ProductReviewSummaryDTO = {
      ...completedReview,
      id: 'review-failed',
      status: 'FAILED',
      score: null,
      reportCompleteness: 'UNKNOWN',
      completedAt: null,
      failureMessage: 'Timed out',
    }

    render(
      <ProductReviewAction
        productUrl="https://example.com"
        activeManualReview={null}
        latestManualReview={failedReview}
        latestCompletedManualReview={null}
      />,
    )

    expect(screen.getByText('Try Product Review again')).toBeInTheDocument()
    expect(screen.getByLabelText('Product Review input')).toBeInTheDocument()
  })

  it('starts an update review and opens the in-flight work report', async () => {
    startScanWithHandoff.mockImplementation(async (options: {
      navigate: (href: string) => void
    }) => {
      options.navigate('/report/review-child')
      return { ok: true, reportId: 'review-child' }
    })

    render(
      <ProductReviewAction
        productUrl="https://example.com"
        activeManualReview={null}
        latestManualReview={completedReview}
        latestCompletedManualReview={completedReview}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /update review/i }))

    await waitFor(() => {
      expect(startScanWithHandoff).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: '/api/reports/review-completed/re-check',
          body: {},
          navigate: expect.any(Function),
        }),
      )
      expect(routerPush).toHaveBeenCalledWith('/report/review-child')
    })
  })

  it('announces an update-review failure without fabricating navigation', async () => {
    startScanWithHandoff.mockResolvedValue({
      ok: false,
      code: 'REVIEW_ACTIVE',
      message: 'A Product Review is already in progress.',
    })

    render(
      <ProductReviewAction
        productUrl="https://example.com"
        activeManualReview={null}
        latestManualReview={completedReview}
        latestCompletedManualReview={completedReview}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /update review/i }))

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('A Product Review is already in progress.')
    expect(routerPush).not.toHaveBeenCalled()
  })
})
