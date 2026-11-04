'use client'

import { RouteErrorPage, type RouteErrorBoundaryProps } from '@/components/ui/route-error-page'
import { SYSTEM_COPY } from '@/lib/marketing/copy-barrel'

export default function AppError({
  error,
  reset,
  retry,
}: RouteErrorBoundaryProps) {
  return (
    <RouteErrorPage
      error={error}
      reset={reset}
      retry={retry}
      event="ui.app.error"
      title={SYSTEM_COPY.errors.app.title}
      description={SYSTEM_COPY.errors.app.body}
      returnHref="/dashboard"
      returnLabel={SYSTEM_COPY.actions.dashboard}
      shell="none"
    />
  )
}
