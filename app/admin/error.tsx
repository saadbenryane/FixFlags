'use client'

import { RouteErrorPage, type RouteErrorBoundaryProps } from '@/components/ui/route-error-page'
import { SYSTEM_COPY } from '@/lib/marketing/copy-barrel'

export default function AdminPageError({
  error,
  reset,
  retry,
}: RouteErrorBoundaryProps) {
  return (
    <RouteErrorPage
      error={error}
      reset={reset}
      retry={retry}
      event="ui.admin.error"
      title={SYSTEM_COPY.errors.admin.title}
      description={SYSTEM_COPY.errors.admin.body}
      returnHref="/admin"
      returnLabel="Admin"
      shell="none"
    />
  )
}
