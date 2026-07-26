'use client'

import { RouteErrorPage } from '@/components/ui/route-error-page'
import { SYSTEM_COPY } from '@/lib/marketing/copy'

export default function MarketingError({
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
      event="ui.marketing.error"
      title={SYSTEM_COPY.errors.marketing.title}
      description={SYSTEM_COPY.errors.marketing.body}
      returnHref="/"
      returnLabel={SYSTEM_COPY.actions.home}
      shell="marketing"
    />
  )
}
