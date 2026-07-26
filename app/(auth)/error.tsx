'use client'

import { RouteErrorPage } from '@/components/ui/route-error-page'
import { SYSTEM_COPY } from '@/lib/marketing/copy'

export default function AuthError({
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
      event="ui.auth.error"
      title={SYSTEM_COPY.errors.auth.title}
      description={SYSTEM_COPY.errors.auth.body}
      returnHref="/"
      returnLabel={SYSTEM_COPY.actions.home}
      shell="marketing"
    />
  )
}
