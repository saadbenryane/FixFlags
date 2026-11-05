'use client'

import { RouteErrorPage, type RouteErrorBoundaryProps } from '@/components/ui/route-error-page'
import { SYSTEM_COPY } from '@/lib/marketing/copy-barrel'

export default function RepoReportError({
  error,
  reset,
  retry,
}: RouteErrorBoundaryProps) {
  return (
    <RouteErrorPage
      error={error}
      reset={reset}
      retry={retry}
      event="ui.repo-report.error"
      title={SYSTEM_COPY.errors.repoReport.title}
      description={SYSTEM_COPY.errors.repoReport.body}
      returnHref="/dashboard"
      returnLabel={SYSTEM_COPY.actions.dashboard}
      shell="audit"
    />
  )
}
