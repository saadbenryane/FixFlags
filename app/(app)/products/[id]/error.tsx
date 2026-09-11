'use client'

import { RouteErrorPage } from '@/components/ui/route-error-page'

export default function ProductError({
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
      event="ui.product.error"
      title="Site could not load"
      description="Your Site data is safe. Try loading the workspace again."
      returnHref="/dashboard"
      returnLabel="All Sites"
    />
  )
}
