import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProductReviewSummaryDTO } from '@/lib/products/workspace'

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}))

vi.mock('@/components/audit/AuditInput', () => ({
  AuditInput: ({ initialUrl }: { initialUrl: string }) => (
    <div aria-label="Product Review input" data-url={initialUrl} />
  ),
}))

import { ProductReviewAction } from '@/components/product/ProductReviewAction'

const completedReview: ProductReviewSummaryDTO = {
  id: 'review-completed',
  kind: 'PRODUCT_REVIEW',
  status: 'COMPLETED',
  score: 81,
  reportCompleteness: 'FULL',
  unresolvedCount: 1,
  createdAt: '2026-08-12T00:00:00.000Z',
  completedAt: '2026-08-12T00:01:00.000Z',
  failureMessage: null,
}

afterEach(() => {
  routerPush.mockReset()
  vi.unstubAllGlobals()
})

describe('ProductReviewAction', () => {
  it('resumes the active manual Product Review in Timeline', () => {
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
      screen.getByRole('link', { name: /resume review/i }),
    ).toHaveAttribute('href', '/report/review-active?view=timeline')
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

  it('starts an update review from the latest completed Review and opens the returned Review', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reportId: 'review-child', status: 'QUEUED' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ProductReviewAction
        productUrl="https://example.com"
        activeManualReview={null}
        latestManualReview={completedReview}
        latestCompletedManualReview={completedReview}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /recheck/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/reports/review-completed/re-check',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        },
      )
      expect(routerPush).toHaveBeenCalledWith(
        '/report/review-child?view=timeline',
      )
    })
    expect(
      screen.getByRole('button', { name: 'Starting Recheck' }),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('announces an update-review failure without fabricating navigation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        headers: new Headers(),
        json: async () => ({
          code: 'REVIEW_ACTIVE',
          message: 'A Product Review is already in progress.',
          requestId: 'request-1',
        }),
      }),
    )

    render(
      <ProductReviewAction
        productUrl="https://example.com"
        activeManualReview={null}
        latestManualReview={completedReview}
        latestCompletedManualReview={completedReview}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /recheck/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A Product Review is already in progress.',
    )
    expect(routerPush).not.toHaveBeenCalled()
  })
})
