'use client'

import { RouteErrorPage } from '@/components/ui/route-error-page'
import { SYSTEM_COPY } from '@/lib/marketing/copy'

export default function ReportPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <RouteErrorPage
      error={error}
      reset={reset}
      event="ui.report.error"
      title={SYSTEM_COPY.errors.report.title}
      description={SYSTEM_COPY.errors.report.body}
      returnHref="/dashboard"
      returnLabel={SYSTEM_COPY.actions.dashboard}
      shell="audit"
    />
  )
}
