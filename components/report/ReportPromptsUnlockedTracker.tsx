'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics/events'

export function ReportPromptsUnlockedTracker({
  auditId,
  promptCount,
}: {
  auditId: string
  promptCount: number
}) {
  useEffect(() => {
    const key = `fixflags:prompts-unlocked:${auditId}`
    if (window.sessionStorage.getItem(key)) return
    window.sessionStorage.setItem(key, '1')
    trackEvent('report_prompts_unlocked', {
      audit_id: auditId,
      prompt_count: promptCount,
    })
  }, [auditId, promptCount])

  return null
}
