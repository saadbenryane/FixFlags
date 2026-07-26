'use client'

import { RouteErrorPage } from '@/components/ui/route-error-page'
import { SYSTEM_COPY } from '@/lib/marketing/copy'

export default function AppError({
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
      event="ui.app.error"
      title={SYSTEM_COPY.errors.app.title}
      description={SYSTEM_COPY.errors.app.body}
      returnHref="/dashboard"
      returnLabel={SYSTEM_COPY.actions.dashboard}
      shell="app"
    />
  )
}
