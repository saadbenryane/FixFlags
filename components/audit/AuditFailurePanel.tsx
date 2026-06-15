'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
    <div className="space-y-4">
      {formattedFailure && (
        <p className="text-xs font-mono uppercase tracking-label text-destructive/80">
          {formattedFailure}
        </p>
      )}
      <p className="text-muted-foreground text-sm">{displayMessage}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {onRetry && (
          <Button variant="default" onClick={onRetry} disabled={retryLoading}>
            {retryLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Retry
          </Button>
        )}
        <Button variant="outline" onClick={handleCopyId} disabled={copying}>
          <Copy className="h-4 w-4 mr-2" />
          Copy job ID
        </Button>
        <Button variant="outline" onClick={handleDownloadLogs}>
          <Download className="h-4 w-4 mr-2" />
          Download logs
        </Button>
      </div>
      <p className="text-xs text-muted-foreground font-mono">ID: {auditId}</p>
    </div>
  )
}
