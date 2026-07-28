'use client'

import { useOneShotEvent } from '@/lib/hooks/useOneShotEvent'

export function ReportPromptsUnlockedTracker({
  auditId,
  promptCount,
}: {
  auditId: string
  promptCount: number
}) {
  useOneShotEvent(
    'report_prompts_unlocked',
    auditId,
    () => ({ prompt_count: promptCount }),
    [auditId, promptCount],
  )

  return null
}
