'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics/events'

/** Fires once when an Update review result is viewed on the report outcome path. */
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
