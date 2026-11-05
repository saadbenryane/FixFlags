'use client'

import { RouteErrorPage, type RouteErrorBoundaryProps } from '@/components/ui/route-error-page'
import { SYSTEM_COPY } from '@/lib/marketing/copy-barrel'

export default function AuthError({
  error,
  reset,
  retry,
}: RouteErrorBoundaryProps) {
  return (
    <RouteErrorPage
      error={error}
      reset={reset}
      retry={retry}
      event="ui.auth.error"
      title={SYSTEM_COPY.errors.auth.title}
      description={SYSTEM_COPY.errors.auth.body}
      returnHref="/"
      returnLabel={SYSTEM_COPY.actions.home}
      shell="none"
    />
  )
}
