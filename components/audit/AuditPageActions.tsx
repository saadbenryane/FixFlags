'use client'
import { useState } from 'react'
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
import { useEffect } from 'react'
import { Plan } from '@prisma/client'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

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
  const [monitoringLoading, setMonitoringLoading] = useState(false)

  useEffect(() => {
    trackEvent('viewed_report', { audit_id: auditId, is_owner: isOwner })
  }, [auditId, isOwner])

  const showMonitoring = isLoggedIn && isOwner
  const monitoringLabel = 'Monitor'

  async function handleMonitoring() {
    setMonitoringLoading(true)
    try {
      const res = await fetch(`/api/reports/${auditId}/monitoring`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        router.push(`/report/${data.reportId}`)
      } else {
        toast.error((await parseApiErrorResponse(res)).message)
      }
    } catch {
      toast.error('Could not start the monitoring. Try again.')
    } finally {
      setMonitoringLoading(false)
    }
  }

  return (
    <>
      {projectLimitForPlan(plan) > 0 && (
        <ProjectAssignSelect
          auditId={auditId}
          initialProjectId={projectId}
          enabled={isLoggedIn}
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
      {showMonitoring && (
        <Button size="sm" onClick={handleMonitoring} disabled={monitoringLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${monitoringLoading ? 'animate-spin' : ''}`} />
          {monitoringLabel}
        </Button>
      )}
    </>
  )
}
