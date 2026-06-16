'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { RefreshCw, Copy, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatFailureCode } from '@/lib/audit/progress-ui'

interface Props {
  auditId: string
  errorMsg?: string | null
  failureCode?: string | null
  failureStage?: string | null
  onRetry?: () => Promise<void>
  retryLoading?: boolean
}

export function AuditFailurePanel({
  auditId,
  errorMsg,
  failureCode,
  failureStage,
  onRetry,
  retryLoading = false,
}: Props) {
  const [copying, setCopying] = useState(false)

  const formattedFailure = formatFailureCode(failureCode, failureStage)
  const displayMessage =
    errorMsg ??
    (failureCode === 'AUDIT_TIMEOUT'
      ? 'This audit took longer than 90 seconds and was stopped.'
      : "We couldn't complete this audit. The site may be unreachable or blocking bots.")

  async function handleCopyId() {
    setCopying(true)
    try {
      await navigator.clipboard.writeText(auditId)
      toast.success('Audit ID copied')
    } catch {
      toast.error('Could not copy, ID: ' + auditId)
    } finally {
      setCopying(false)
    }
  }

  function handleDownloadLogs() {
    window.open(`/api/audits/${auditId}/logs`, '_blank')
  }

  return (
    <Callout variant="danger" title="Check failed">
      {formattedFailure && (
        <p className="font-mono text-xs uppercase tracking-label text-destructive/80">
          {formattedFailure}
        </p>
      )}
      <p>{displayMessage}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {onRetry && (
          <Button variant="default" onClick={onRetry} disabled={retryLoading}>
            {retryLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Retry
          </Button>
        )}
        <Button variant="outline" onClick={handleCopyId} disabled={copying}>
          <Copy className="mr-2 h-4 w-4" />
          Copy job ID
        </Button>
        <Button variant="outline" onClick={handleDownloadLogs}>
          <Download className="mr-2 h-4 w-4" />
          Download logs
        </Button>
      </div>
      <p className="mt-2 font-mono text-xs text-muted-foreground">ID: {auditId}</p>
    </Callout>
  )
}
