'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics/events'

/** Fires once when a re-check result is viewed (compare page or report with diff). */
export function RecheckCompletedTracker({
  auditId,
  parentAuditId,
  outcome = 'compared',
}: {
  auditId: string
  parentAuditId: string
  outcome?: string
}) {
  useEffect(() => {
    trackEvent('recheck_completed', {
      audit_id: auditId,
      parent_audit_id: parentAuditId,
      outcome,
    })
  }, [auditId, parentAuditId, outcome])

  return null
}
