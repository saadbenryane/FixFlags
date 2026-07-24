'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/analytics/events'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { startScanWithHandoff } from '@/lib/audit/start-scan-handoff'

export function ReportRecheckButton({ auditId, url }: { auditId: string; url: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function recheck() {
    setPending(true)
    try {
      await startScanWithHandoff(router, {
        url,
        endpoint: `/api/reports/${auditId}/monitoring`,
        body: {},
        errorFallback: REPORT_COPY.recheck.error,
        onStarted: () => {
          trackEvent('recheck_started', { audit_id: auditId })
        },
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Button onClick={recheck} disabled={pending} className="min-h-11">
      <RefreshCw className={pending ? 'animate-spin' : undefined} />
      {REPORT_COPY.recheck.label}
    </Button>
  )
}
