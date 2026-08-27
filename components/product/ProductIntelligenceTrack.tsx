'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics/events'

/** Fires remember_shown when verified learnings are visible on the Product page. */
export function ProductIntelligenceTrack({
  auditId,
  learningCount,
}: {
  auditId: string | null
  learningCount: number
}) {
  useEffect(() => {
    if (!auditId || learningCount <= 0) return
    trackEvent('remember_shown', {
      audit_id: auditId,
      learning_count: learningCount,
    })
  }, [auditId, learningCount])

  return null
}
