'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { Button } from '@/components/ui/button'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import type { ProductReviewSummaryDTO } from '@/lib/products/workspace'
import { REPORT_COPY } from '@/lib/marketing/copy'

type ProductReviewActionProps = {
  productUrl: string
  activeManualReview: ProductReviewSummaryDTO | null
  latestManualReview: ProductReviewSummaryDTO | null
  latestCompletedManualReview: ProductReviewSummaryDTO | null
}

export function ProductReviewAction({
  productUrl,
  activeManualReview,
  latestManualReview,
  latestCompletedManualReview,
}: ProductReviewActionProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (activeManualReview) {
    return (
      <div className="flex w-full items-center justify-end">
        <Button asChild variant="brand" className="w-full shrink-0 sm:w-auto">
          <Link href={`/report/${activeManualReview.id}?view=report`}>
            Open review
          </Link>
        </Button>
      </div>
    )
  }

  if (!latestCompletedManualReview) {
    const retrying = latestManualReview?.status === 'FAILED'
    return (
      <div className="space-y-3">
        <div>
          <p className="font-medium">
            {retrying ? 'Try Product Review again' : 'Start Product Review'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {retrying
              ? 'The last Product Review did not finish. Start a fresh Review of this Product.'
              : 'Establish the first independent observation of this Product.'}
          </p>
        </div>
        <AuditInput
          initialUrl={productUrl}
          idSuffix="-product-workspace"
          source="dashboard"
        />
      </div>
    )
  }

  const retrying = latestManualReview?.status === 'FAILED'
  const baselineReviewId = latestCompletedManualReview.id

  async function startUpdateReview() {
    setBusy(true)
    setError('')

    try {
      const response = await fetch(
        `/api/reports/${baselineReviewId}/re-check`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      )

      if (!response.ok) {
        const parsed = await parseApiErrorResponse(response)
        setError(parsed.message)
        setBusy(false)
        return
      }

      const result = (await response.json()) as { reportId?: unknown }
      const stayId =
        typeof result.reportId === 'string' && result.reportId.length > 0
          ? result.reportId
          : baselineReviewId
      router.push(
        `/report/${encodeURIComponent(stayId)}`,
      )
    } catch {
      setError(REPORT_COPY.recheck.error)
      setBusy(false)
    }
  }

  return (
    <div className="flex w-full flex-col items-end gap-2">
        {error ? (
          <p
            id="product-review-action-error"
            role="alert"
            className="mt-2 flex items-start gap-2 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
        <Button
          variant="brand"
          className="w-full sm:w-auto"
          type="button"
          onClick={startUpdateReview}
          loading={busy}
          loadingLabel="Starting update review"
          aria-describedby={error ? 'product-review-action-error' : undefined}
        >
          <RefreshCw aria-hidden />
          {retrying ? 'Try update review again' : 'Update review'}
        </Button>
    </div>
  )
}
