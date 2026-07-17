'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw, ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'

import { CopyMcpCommand } from '@/components/audit/CopyMcpCommand'
import { ShareDrawer } from '@/components/audit/ShareDrawer'
import { ExportMenu } from '@/components/audit/ExportMenu'
import { ProjectAssignSelect } from '@/components/audit/ProjectAssignSelect'
import { projectLimitForPlan } from '@/lib/billing/plans'
import { trackEvent } from '@/lib/analytics/events'
import { Plan } from '@prisma/client'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { REPORT_COPY } from '@/lib/marketing/copy'

import type { RankableFlag } from '@/lib/audit/priority-flags'

interface Props {
  auditId: string
  url: string
  score: number | null
  verdict?: string | null
  topIssue?: string
  flags?: RankableFlag[]
  rubrics: Array<{
    name: string
    grade: string | null
    score: number | null
    flags?: Array<{ severity: string; problem: string }>
  }>
  isPaid: boolean
  isLoggedIn: boolean
  isOwner: boolean
  isAnonymous: boolean
  isPublic: boolean
  compareAuditId?: string | null
  plan?: Plan
  projectId?: string | null
  canExportSummary?: boolean
  canSharePublicly?: boolean
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
  isPaid,
  isLoggedIn,
  isOwner,
  isAnonymous,
  isPublic: initialIsPublic,
  compareAuditId,
  plan = 'FREE',
  projectId,
  canExportSummary = false,
  canSharePublicly = false,
  showFixPrompts = false,
  toolbar = false,
}: Props) {
  const router = useRouter()
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [recheckLoading, setRecheckLoading] = useState(false)

  useEffect(() => {
    trackEvent('viewed_report', { audit_id: auditId, is_owner: isOwner })
  }, [auditId, isOwner])

  const showRecheck = isLoggedIn && isOwner

  async function handleRecheck() {
    setRecheckLoading(true)
    try {
      const res = await fetch(`/api/reports/${auditId}/monitoring`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        trackEvent('recheck_started', { audit_id: auditId })
        router.push(`/report/${data.reportId}`)
      } else {
        toast.error((await parseApiErrorResponse(res)).message)
      }
    } catch {
      toast.error(REPORT_COPY.recheck.error)
    } finally {
      setRecheckLoading(false)
    }
  }

  return (
    <>
      {projectLimitForPlan(plan) > 0 && (
        <ProjectAssignSelect
          auditId={auditId}
          initialProjectId={projectId}
          enabled={isLoggedIn}
          compact={toolbar}
        />
      )}
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
        onPublicChange={setIsPublic}
      />
      <ExportMenu
        auditId={auditId}
        url={url}
        score={score}
        verdict={verdict}
        rubrics={rubrics}
        flags={flags ?? []}
        canExportSummary={canExportSummary}
        showFixPrompts={showFixPrompts}
      />
      {!toolbar && isPaid && <CopyMcpCommand auditId={auditId} />}
      {showRecheck && (
        <Button size="sm" onClick={handleRecheck} disabled={recheckLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${recheckLoading ? 'animate-spin' : ''}`} />
          {REPORT_COPY.recheck.label}
        </Button>
      )}
    </>
  )
}
