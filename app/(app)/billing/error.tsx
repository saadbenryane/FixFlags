'use client'

import { helpHrefForSurface } from '@/lib/help/contextual'
import { HelpSupportActions } from '@/components/help/HelpSupportActions'
import { RouteErrorPage } from '@/components/ui/route-error-page'
import { SYSTEM_COPY } from '@/lib/marketing/copy'

export default function BillingError({
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
      event="ui.billing.error"
      title={SYSTEM_COPY.errors.billing.title}
      description={SYSTEM_COPY.errors.billing.body}
      returnHref="/dashboard"
      returnLabel={SYSTEM_COPY.actions.dashboard}
    >
      <HelpSupportActions helpHref={helpHrefForSurface('billing_error')} />
    </RouteErrorPage>
  )
}
