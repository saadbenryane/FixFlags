'use client'

import { cn, rubricLabel, shareStatusColor } from '@/lib/utils'
import { RubricStatusBadge } from '@/components/audit/RubricStatusBadge'
import type { RubricComputed } from '@/lib/audit/rubric'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

interface Props {
  shareStatus: string
  rubrics: RubricComputed[]
}

function shareStatusMessage(shareStatus: string, criticalCount: number): string {
  if (shareStatus === 'good_to_share') {
    return 'No critical Flags found. Good to share.'
  }
  if (criticalCount === 1) {
    return '1 critical. Fix this before sharing.'
  }
  return `${criticalCount} critical. Fix these before sharing.`
}

export function ShareStatusBanner({ shareStatus, rubrics }: Props) {
  const isReady = shareStatus === 'good_to_share'
  const Icon = isReady ? CheckCircle2 : AlertTriangle
  const criticalCount = rubrics.reduce((sum, r) => sum + r.criticalCount, 0)
  const message = shareStatusMessage(shareStatus, criticalCount)

  return (
    <div
      className={cn(
        'rounded-card border-0 p-4 space-y-3 shadow-card',
        isReady ? 'bg-grade-A/8' : 'bg-grade-C/8'
      )}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={cn(
            'rounded-lg border px-3 py-1.5 text-sm font-semibold inline-flex items-center gap-2',
            shareStatusColor(shareStatus)
          )}
        >
          <Icon className="h-4 w-4" />
          {message}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {rubrics.map((r) => (
          <RubricStatusBadge
            key={r.name}
            status={r.status}
            label={rubricLabel(r.name)}
            size="sm"
          />
        ))}
      </div>
    </div>
  )
}
