'use client'

import { RouteErrorPage } from '@/components/ui/route-error-page'
import { SYSTEM_COPY } from '@/lib/marketing/copy'

export default function AdminPageError({
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
      event="ui.admin.error"
      title={SYSTEM_COPY.errors.admin.title}
      description={SYSTEM_COPY.errors.admin.body}
      returnHref="/admin"
      returnLabel="Admin"
      shell="admin"
    />
  )
}
