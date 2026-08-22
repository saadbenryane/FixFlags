import type { ProductReviewSummaryDTO } from '@/lib/products/workspace'

export type ProductReviewPresentation = {
  label: string
  score: string
  tone: 'secondary' | 'destructive' | 'outline'
}

/** One honest Review-state projection for Product cards and workspaces. */
export function presentProductReview(
  review: ProductReviewSummaryDTO | null,
): ProductReviewPresentation {
  if (!review)
    return { label: 'No Review yet', score: 'Unavailable', tone: 'secondary' }
  if (review.status === 'FAILED') {
    return {
      label: 'Review failed',
      score: 'Unavailable',
      tone: 'destructive',
    }
  }
  if (review.status === 'QUEUED') {
    return { label: 'Queued', score: 'Pending', tone: 'secondary' }
  }
  if (review.status === 'CAPTURING') {
    return {
      label: 'Capturing the Product',
      score: 'Pending',
      tone: 'secondary',
    }
  }
  if (review.status === 'CHECKING') {
    return { label: 'Checking evidence', score: 'Pending', tone: 'secondary' }
  }
  if (review.status === 'JUDGING') {
    return { label: 'Preparing Flags', score: 'Pending', tone: 'secondary' }
  }
  if (review.status === 'FINALIZING') {
    return { label: 'Finalizing report', score: 'Pending', tone: 'secondary' }
  }
  return {
    label:
      review.reportCompleteness === 'PARTIAL'
        ? 'Completed with partial evidence'
        : 'Completed',
    score: review.score === null ? 'Unavailable' : String(review.score),
    tone: 'outline',
  }
}
