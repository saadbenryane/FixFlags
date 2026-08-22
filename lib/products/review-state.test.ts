import { describe, expect, it } from 'vitest'
import { presentProductReview } from '@/lib/products/review-state'
import type { ProductReviewSummaryDTO } from '@/lib/products/workspace'

const base: ProductReviewSummaryDTO = {
  id: 'review-1',
  kind: 'PRODUCT_REVIEW',
  status: 'COMPLETED',
  score: 82,
  reportCompleteness: 'FULL',
  unresolvedCount: 1,
  createdAt: '2026-08-20T00:00:00.000Z',
  completedAt: '2026-08-20T00:01:00.000Z',
  failureMessage: null,
}

describe('presentProductReview', () => {
  it.each([
    'QUEUED',
    'CAPTURING',
    'CHECKING',
    'JUDGING',
    'FINALIZING',
  ] as const)('presents %s without inventing a score', (status) => {
    expect(presentProductReview({ ...base, status, score: null }).score).toBe(
      'Pending',
    )
  })

  it('distinguishes completed, failed, and absent evidence', () => {
    expect(presentProductReview(base)).toMatchObject({
      label: 'Completed',
      score: '82',
    })
    expect(presentProductReview({ ...base, status: 'FAILED' })).toMatchObject({
      label: 'Review failed',
      score: 'Unavailable',
    })
    expect(presentProductReview(null)).toMatchObject({
      label: 'No Review yet',
      score: 'Unavailable',
    })
  })
})
