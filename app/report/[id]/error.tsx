'use client'

import { HelpSupportActions } from '@/components/help/HelpSupportActions'
import { RouteErrorPage, type RouteErrorBoundaryProps } from '@/components/ui/route-error-page'
import { SYSTEM_COPY } from '@/lib/marketing/copy-barrel'
import { helpHrefForSurface } from '@/lib/help/contextual'

export default function ReportPageError({
  error,
  reset,
  retry,
}: RouteErrorBoundaryProps) {
  return (
    <RouteErrorPage
      error={error}
      reset={reset}
      retry={retry}
      event="ui.report.error"
      title={SYSTEM_COPY.errors.report.title}
      description={SYSTEM_COPY.errors.report.body}
      returnHref="/dashboard"
      returnLabel={SYSTEM_COPY.actions.dashboard}
      shell="audit"
    >
      <HelpSupportActions
        helpHref={helpHrefForSurface('audit_failure')}
        articleTitle="Why a check failed"
      />
    </RouteErrorPage>
  )
}
