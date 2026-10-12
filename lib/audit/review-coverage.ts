export type ReviewCoverage = {
  reviewedPageCount: number
  linkedPageCount: number
  openCheckCount: number
  partial: boolean
}

export function parseReviewCoverage(value: unknown): ReviewCoverage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const reviewedPageCount = Number(record.reviewedPageCount)
  const linkedPageCount = Number(record.linkedPageCount)
  const openCheckCount = Number(record.openCheckCount)
  if (!Number.isFinite(reviewedPageCount) || !Number.isFinite(openCheckCount)) return null
  return {
    reviewedPageCount,
    linkedPageCount: Number.isFinite(linkedPageCount)
      ? linkedPageCount
      : Math.max(0, reviewedPageCount - 1),
    openCheckCount,
    partial: Boolean(record.partial),
  }
}

