'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw, ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'

import { CopyMcpCommand } from '@/components/audit/CopyMcpCommand'
import { ShareAuditButton } from '@/components/audit/ShareAuditButton'
import { ExportSummaryButton } from '@/components/audit/ExportSummaryButton'
import { ProjectAssignSelect } from '@/components/audit/ProjectAssignSelect'
import { projectLimitForPlan } from '@/lib/billing/plans'
import { Plan } from '@prisma/client'
import { getUpgradeMomentContent } from '@/lib/billing/upgrade-moments'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

interface Props {
  auditId: string
  url: string
  score: number | null
  verdict?: string | null
  topIssue?: string
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
}

export function AuditPageActions({
  auditId,
  url,
  score,
  verdict,
  topIssue,
  rubrics,
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
}: Props) {
  const router = useRouter()
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [recheckLoading, setRecheckLoading] = useState(false)

  const showRecheck = isLoggedIn && isOwner
  const recheckLabel = 'Re-check'

  async function handleRecheck() {
    setRecheckLoading(true)
    try {
      const res = await fetch(`/api/reports/${auditId}/recheck`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        router.push(`/report/${data.reportId}`)
      } else if (res.status === 402) {
        const error = await parseApiErrorResponse(res)
        const moment = error.code === 'UPGRADE_REQUIRED' ? 'trial_exhausted' : 'free_default'
        const content = getUpgradeMomentContent(moment)
        toast.error(content.headline, {
          description: content.body,
          action: {
            label: 'Upgrade',
            onClick: () => router.push('/pricing'),
          },
        })
      } else {
        toast.error((await parseApiErrorResponse(res)).message)
      }
    } catch {
      toast.error('Could not start the re-check. Try again.')
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
      <ShareAuditButton
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
      <ExportSummaryButton
        auditId={auditId}
        url={url}
        score={score}
        verdict={verdict}
        rubrics={rubrics}
        canExport={canExportSummary}
      />
      {isPaid && <CopyMcpCommand auditId={auditId} />}
      {showRecheck && (
        <Button size="sm" onClick={handleRecheck} disabled={recheckLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${recheckLoading ? 'animate-spin' : ''}`} />
          {recheckLabel}
        </Button>
      )}
    </>
  )
}
