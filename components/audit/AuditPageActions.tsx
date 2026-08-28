'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

import { ExportMenu } from '@/components/audit/ExportMenu'
import { trackEvent } from '@/lib/analytics/events'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { startScanWithHandoff } from '@/lib/audit/start-scan-handoff'

import type { RankableFlag } from '@/lib/audit/priority-flags'

interface Props {
  auditId: string
  url: string
  score: number | null
  verdict?: string | null
  flags?: RankableFlag[]
  contract?: import('@/lib/audit/product-contract').ProductContract | null
  rubrics: Array<{
    name: string
    grade: string | null
    score: number | null
    rubricPrompt?: string | null
    flags?: Array<{ severity: string; problem: string }>
  }>
  isLoggedIn: boolean
  isOwner: boolean
  /** Cookie-claimed anonymous teaser (ff_anon_report_ids). Recheck must work. */
  isClaimedAnonymous?: boolean
  canExportSummary?: boolean
  showFixPrompts?: boolean
  variant?: 'all' | 'update' | 'secondary'
}

export function AuditPageActions({
  auditId,
  url,
  score,
  verdict,
  rubrics,
  flags = [],
  contract = null,
  isLoggedIn,
  isOwner,
  isClaimedAnonymous = false,
  canExportSummary = false,
  showFixPrompts = false,
  variant = 'all',
}: Props) {
  const router = useRouter()
  const [recheckLoading, setRecheckLoading] = useState(false)
  const canRecheck = isOwner || isClaimedAnonymous
  const canManage = isLoggedIn && isOwner

  if (!canRecheck) return null

  async function handleRecheck() {
    setRecheckLoading(true)
    try {
      const result = await startScanWithHandoff({
        url,
        endpoint: `/api/reports/${auditId}/re-check`,
        body: {},
        errorFallback: REPORT_COPY.recheck.error,
        navigate: (href) => router.replace(href as Route),
        onStarted: () => {
          trackEvent('recheck_started', { audit_id: auditId })
        },
      })
      if (!result.ok) toast.error(result.message)
    } finally {
      setRecheckLoading(false)
    }
  }

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-2">
      {variant !== 'secondary' ? (
        <Button
          size="default"
          variant="outline"
          className="min-h-11 rounded-[var(--radius-control)]"
          onClick={handleRecheck}
          loading={recheckLoading}
          loadingLabel={REPORT_COPY.recheck.label}
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          {REPORT_COPY.recheck.label}
        </Button>
      ) : null}
      {canManage && variant !== 'update' ? (
        <ExportMenu
          auditId={auditId}
          url={url}
          score={score}
          verdict={verdict}
          rubrics={rubrics}
          flags={flags ?? []}
          contract={contract}
          canExportSummary={canExportSummary}
          showFixPrompts={showFixPrompts}
        />
      ) : null}
    </div>
  )
}
