'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics/events'

/** Fires once when the before/after compare page mounts after a re-check. */
export function RecheckCompletedTracker({
  auditId,
  parentAuditId,
}: {
  auditId: string
  parentAuditId: string
}) {
  useEffect(() => {
    trackEvent('recheck_completed', {
      audit_id: auditId,
      parent_audit_id: parentAuditId,
      outcome: 'compared',
    })
  }, [auditId, parentAuditId])

  return null
}
