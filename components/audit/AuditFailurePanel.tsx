'use client'

import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { RefreshCw, Loader2 } from 'lucide-react'
import { AUDIT_ERRORS } from '@/lib/marketing/copy'
import { getUserFacingAuditError } from '@/lib/audit/user-facing-errors'
import { helpHrefForFailureCode } from '@/lib/help/contextual'
import { HelpSupportActions } from '@/components/help/HelpSupportActions'

interface Props {
  failureCode?: string | null
  onRetry?: () => Promise<void>
  retryLoading?: boolean
}

export function AuditFailurePanel({
  failureCode,
  onRetry,
  retryLoading = false,
}: Props) {
  const displayMessage = getUserFacingAuditError(failureCode)
  const helpHref = helpHrefForFailureCode(failureCode)

  return (
    <Callout variant="danger" title={AUDIT_ERRORS.checkFailedTitle}>
      <p>{displayMessage}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {onRetry && (
          <Button variant="default" onClick={onRetry} disabled={retryLoading}>
            {retryLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {AUDIT_ERRORS.retryCta}
          </Button>
        )}
        <HelpSupportActions helpHref={helpHref} articleTitle="Why a check failed" />
      </div>
    </Callout>
  )
}
