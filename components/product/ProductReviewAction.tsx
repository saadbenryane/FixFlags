'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Clock3, RefreshCw, TriangleAlert } from 'lucide-react'
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Product Review in progress</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Return to the Timeline to see what FixFlags is observing.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href={`/report/${activeManualReview.id}?view=timeline`}>
            <Clock3 aria-hidden />
            Resume Review
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
      if (typeof result.reportId !== 'string' || result.reportId.length === 0) {
        setError(
          'Recheck started, but FixFlags could not open it. Try again.',
        )
        setBusy(false)
        return
      }

      router.push(
        `/report/${encodeURIComponent(result.reportId)}?view=timeline`,
      )
    } catch {
      setError(REPORT_COPY.recheck.error)
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">
          {retrying ? 'Try Recheck again' : 'Ready to Recheck?'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {retrying
            ? 'The latest attempt did not finish. Start a fresh comparison from the last completed Review.'
            : REPORT_COPY.recheck.helper}
        </p>
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
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <Button asChild variant="outline">
          <Link href={`/report/${latestCompletedManualReview.id}?view=report`}>
            Open latest report
          </Link>
        </Button>
        <Button
          type="button"
          onClick={startUpdateReview}
          loading={busy}
          loadingLabel="Starting Recheck"
          aria-describedby={error ? 'product-review-action-error' : undefined}
        >
          <RefreshCw aria-hidden />
          {retrying ? 'Try Recheck again' : REPORT_COPY.recheck.label}
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  )
}
