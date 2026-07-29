'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RefreshCw, ArrowLeftRight } from 'lucide-react'

import { CopyMcpCommand } from '@/components/audit/CopyMcpCommand'
import { ShareDrawer } from '@/components/audit/ShareDrawer'
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
  topIssue?: string
  flags?: RankableFlag[]
  contract?: import('@/lib/audit/product-contract').ProductContract | null
  rubrics: Array<{
    name: string
    grade: string | null
    score: number | null
    rubricPrompt?: string | null
    flags?: Array<{ severity: string; problem: string }>
  }>
  isPaid: boolean
  isLoggedIn: boolean
  isOwner: boolean
  isAnonymous: boolean
  isPublic: boolean
  compareAuditId?: string | null
  canExportSummary?: boolean
  canSharePublicly?: boolean
  shareStatus?: string
  showFixPrompts?: boolean
  toolbar?: boolean
}

export function AuditPageActions({
  auditId,
  url,
  score,
  verdict,
  topIssue,
  rubrics,
  flags = [],
  contract = null,
  isPaid,
  isLoggedIn,
  isOwner,
  isAnonymous,
  isPublic: initialIsPublic,
  compareAuditId,
  canExportSummary = false,
  canSharePublicly = false,
  shareStatus,
  showFixPrompts = false,
  toolbar = false,
}: Props) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [recheckLoading, setRecheckLoading] = useState(false)

  useEffect(() => {
    trackEvent('viewed_report', { audit_id: auditId, is_owner: isOwner })
  }, [auditId, isOwner])

  const showRecheck = isLoggedIn && isOwner

  async function handleRecheck() {
    setRecheckLoading(true)
    try {
      const result = await startScanWithHandoff({
        url,
        endpoint: `/api/reports/${auditId}/re-check`,
        body: {},
        errorFallback: REPORT_COPY.recheck.error,
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
    <>
      {compareAuditId && (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/compare/${compareAuditId}`}>
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            View comparison
          </Link>
        </Button>
      )}
      <ShareDrawer
        auditId={auditId}
        score={score}
        topIssue={topIssue}
        isLoggedIn={isLoggedIn}
        isOwner={isOwner}
        isPublic={isPublic}
        isAnonymous={isAnonymous}
        canPublicShare={canSharePublicly}
        shareStatus={shareStatus}
        onPublicChange={setIsPublic}
      />
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
      {!toolbar && isPaid && <CopyMcpCommand auditId={auditId} />}
      {showRecheck && (
        <Button
          size="sm"
          onClick={handleRecheck}
          loading={recheckLoading}
          loadingLabel={REPORT_COPY.recheck.label}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {REPORT_COPY.recheck.label}
        </Button>
      )}
    </>
  )
}
