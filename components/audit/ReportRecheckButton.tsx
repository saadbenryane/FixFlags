'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { trackEvent } from '@/lib/analytics/events'
import { REPORT_COPY } from '@/lib/marketing/copy'

export function ReportRecheckButton({ auditId }: { auditId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function recheck() {
    setPending(true)
    try {
      const response = await fetch(`/api/reports/${auditId}/monitoring`, { method: 'POST' })
      if (!response.ok) throw new Error((await parseApiErrorResponse(response)).message)
      const result = (await response.json()) as { reportId: string }
      trackEvent('recheck_started', { audit_id: auditId })
      router.push(`/report/${result.reportId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : REPORT_COPY.recheck.error)
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
