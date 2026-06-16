'use client'

import { Callout } from '@/components/ui/callout'
import { RubricStatusBadge } from '@/components/audit/RubricStatusBadge'
import { rubricLabel } from '@/lib/utils'
import type { RubricComputed } from '@/lib/audit/rubric'

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
  const criticalCount = rubrics.reduce((sum, r) => sum + r.criticalCount, 0)
  const message = shareStatusMessage(shareStatus, criticalCount)

  return (
    <Callout variant={isReady ? 'success' : 'warning'} title={message}>
      <div className="flex flex-wrap items-center gap-2">
        {rubrics.map((r) => (
          <RubricStatusBadge
            key={r.name}
            status={r.status}
            label={rubricLabel(r.name)}
            size="sm"
          />
        ))}
      </div>
    </Callout>
  )
}
