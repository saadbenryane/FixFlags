'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { REPORT_COPY } from '@/lib/marketing/copy'

/**
 * While prescription is still generating after COMPLETED, poll until aiReviewAt
 * is set, then refresh so fix prompts appear without a manual reload.
 * After max attempts, surface a soft refresh prompt instead of hanging silently.
 */
export function AiReviewPendingRefresh({
  auditId,
  enabled,
}: {
  auditId: string
  enabled: boolean
}) {
  const router = useRouter()
  const cancelledRef = useRef(false)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setTimedOut(false)
      return
    }
    cancelledRef.current = false
    setTimedOut(false)
    let attempts = 0
    const maxAttempts = 45
    let timeoutId = 0

    const tick = async () => {
      if (cancelledRef.current) return
      if (attempts >= maxAttempts) {
        setTimedOut(true)
        return
      }
      attempts += 1
      try {
        const res = await fetch(`/api/reports/${auditId}/status`)
        if (res.ok) {
          const data = (await res.json()) as { aiReviewAt?: string | null }
          if (data.aiReviewAt) {
            router.refresh()
            return
          }
        }
      } catch {
        // ignore transient poll errors; keep trying until maxAttempts
      }
      if (!cancelledRef.current) {
        timeoutId = window.setTimeout(tick, 2000)
      }
    }

    timeoutId = window.setTimeout(tick, 1500)
    return () => {
      cancelledRef.current = true
      window.clearTimeout(timeoutId)
    }
  }, [auditId, enabled, router])

  if (!enabled || !timedOut) return null

  return (
    <div className="mx-auto max-w-report px-4 pb-4">
      <Callout variant="info" title={REPORT_COPY.aiPending.stillPendingTitle}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-pretty">{REPORT_COPY.aiPending.stillPendingBody}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => router.refresh()}
          >
            {REPORT_COPY.aiPending.refreshCta}
          </Button>
        </div>
      </Callout>
    </div>
  )
}
