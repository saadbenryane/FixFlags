'use client'

import { Callout } from '@/components/ui/callout'
import { RubricStatusBadge } from '@/components/audit/RubricStatusBadge'
import { rubricLabel } from '@/lib/utils'
import type { RubricComputed } from '@/lib/audit/rubric'
import { shareStatusMessage } from '@/lib/audit/share-status'

interface Props {
  shareStatus: string
  rubrics: RubricComputed[]
}

export function ShareStatusBanner({ shareStatus, rubrics }: Props) {
  const isReady = shareStatus === 'good_to_share'
  const message = shareStatusMessage(shareStatus)

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
