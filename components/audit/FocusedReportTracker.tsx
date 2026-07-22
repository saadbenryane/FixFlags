'use client'

import { useEffect } from 'react'
import {
  trackEvent,
  type ReportAccessState,
} from '@/lib/analytics/events'

export function FocusedReportTracker({
  auditId,
  accessState,
  itemCount,
  firstFinding,
}: {
  auditId: string
  accessState: ReportAccessState
  itemCount: number
  firstFinding?: { checkId?: string | null; severity?: string | null } | null
}) {
  useEffect(() => {
    trackEvent('viewed_report', {
      audit_id: auditId,
      is_owner: accessState === 'owner',
      surface: 'focused',
      access_state: accessState,
      item_count: itemCount,
    })
    if (firstFinding) {
      trackEvent('first_finding_viewed', {
        audit_id: auditId,
        check_id: firstFinding.checkId ?? undefined,
        severity: firstFinding.severity ?? undefined,
        surface: 'focused',
        access_state: accessState,
        item_position: 1,
      })
    }
  }, [accessState, auditId, firstFinding, itemCount])

  return null
}
