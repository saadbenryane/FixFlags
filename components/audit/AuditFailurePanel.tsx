'use client'

import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { RefreshCw, Loader2 } from 'lucide-react'

interface Props {
  errorMsg?: string | null
  failureCode?: string | null
  onRetry?: () => Promise<void>
  retryLoading?: boolean
}

export function AuditFailurePanel({
  errorMsg,
  failureCode,
  onRetry,
  retryLoading = false,
}: Props) {
  const displayMessage =
    errorMsg ??
    (failureCode === 'AUDIT_TIMEOUT'
      ? 'This check took longer than expected and was stopped. Please try again.'
      : "We couldn't complete this check. The site may be unreachable or blocking automated visits.")

  return (
    <Callout variant="danger" title="Check failed">
      <p>{displayMessage}</p>
      {onRetry && (
        <div className="mt-4 flex justify-center">
          <Button variant="default" onClick={onRetry} disabled={retryLoading}>
            {retryLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Retry
          </Button>
        </div>
      )}
    </Callout>
  )
}
