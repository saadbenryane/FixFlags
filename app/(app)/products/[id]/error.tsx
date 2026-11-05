'use client'

import { RouteErrorPage, type RouteErrorBoundaryProps } from '@/components/ui/route-error-page'

export default function ProductError({
  error,
  reset,
  retry,
}: RouteErrorBoundaryProps) {
  return (
    <RouteErrorPage
      error={error}
      reset={reset}
      retry={retry}
      event="ui.product.error"
      title="Site could not load"
      description="Your Site data is safe. Try loading the workspace again."
      returnHref="/dashboard"
      returnLabel="All Sites"
    />
  )
}
