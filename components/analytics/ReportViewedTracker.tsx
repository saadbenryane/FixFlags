'use client'

import { useOneShotEvent } from '@/lib/hooks/useOneShotEvent'
import type { ReportAccessState, ReportSurface } from '@/lib/analytics/events'

export function ReportViewedTracker({
  auditId,
  isOwner,
  accessState,
  surface = 'focused',
  enabled = true,
}: {
  auditId: string
  isOwner?: boolean
  accessState?: ReportAccessState
  surface?: ReportSurface
  enabled?: boolean
}) {
  useOneShotEvent(
    'viewed_report',
    auditId,
    () => {
      if (!enabled) return null
      return {
        is_owner: isOwner,
        access_state: accessState,
        surface,
      }
    },
    [auditId, enabled, isOwner, accessState, surface],
  )

  return null
}
