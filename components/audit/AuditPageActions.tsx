'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw, Share2, ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'

import { ProjectAssignSelect } from '@/components/audit/ProjectAssignSelect'
import { projectLimitForPlan } from '@/lib/billing/plans'
import { Plan } from '@prisma/client'
import { getUpgradeMomentContent } from '@/lib/billing/upgrade-moments'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

interface Props {
  auditId: string
  isPaid: boolean
  isLoggedIn: boolean
  isPublic: boolean
  hasParent: boolean
  compareAuditId?: string | null
  plan?: Plan
  projectId?: string | null
  canUseFreeRecheck?: boolean
  canSharePublicly?: boolean
}

export function AuditPageActions({
  auditId,
  isPaid,
  isLoggedIn,
  isPublic: initialIsPublic,
  compareAuditId,
  plan = 'FREE',
  projectId,
  canUseFreeRecheck = false,
  canSharePublicly = false,
}: Props) {
  const router = useRouter()
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [recheckLoading, setRecheckLoading] = useState(false)

  const showRecheck = isPaid || canUseFreeRecheck
  const recheckLabel = canUseFreeRecheck && !isPaid ? 'Re-check free (1x)' : 'Re-check'

  async function handleShare() {
    try {
      const res = await fetch(`/api/audits/${auditId}/toggle-public`, { method: 'PATCH' })
      if (res.ok) {
        const data = await res.json()
        setIsPublic(data.isPublic)
        if (data.isPublic) {
          await navigator.clipboard.writeText(window.location.href)
          toast.success('Report is now public. URL copied to clipboard.')
        } else {
          toast.success('Report is now private.')
        }
      } else {
        const error = await parseApiErrorResponse(res)
        if (res.status !== 402 || error.code !== 'UPGRADE_REQUIRED') {
          toast.error(error.message)
          return
        }
        const content = getUpgradeMomentContent('share_blocked')
        toast.error(content.headline, {
          description: content.body,
          action: {
            label: 'View Agency plan',
            onClick: () => router.push('/pricing'),
          },
        })
      }
    } catch {
      toast.error('Failed to update sharing')
    }
  }

  async function handleRecheck() {
    setRecheckLoading(true)
    try {
      const res = await fetch(`/api/audits/${auditId}/recheck`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        router.push(`/audit/${data.auditId}`)
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
      {isLoggedIn && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          title={
            !canSharePublicly && !isPublic
              ? 'Upgrade to Agency to share client report links'
              : undefined
          }
        >
          <Share2 className="h-4 w-4 mr-2" />
          {isPublic ? 'Make private' : 'Share'}
        </Button>
      )}
      {showRecheck && (
        <Button size="sm" onClick={handleRecheck} disabled={recheckLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${recheckLoading ? 'animate-spin' : ''}`} />
          {recheckLabel}
        </Button>
      )}
    </>
  )
}
