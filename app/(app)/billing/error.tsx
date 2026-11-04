'use client'

import { helpHrefForSurface } from '@/lib/help/contextual'
import { HelpSupportActions } from '@/components/help/HelpSupportActions'
import { RouteErrorPage, type RouteErrorBoundaryProps } from '@/components/ui/route-error-page'
import { SYSTEM_COPY } from '@/lib/marketing/copy-barrel'

export default function BillingError({
  error,
  reset,
  retry,
}: RouteErrorBoundaryProps) {
  return (
    <RouteErrorPage
      error={error}
      reset={reset}
      retry={retry}
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
