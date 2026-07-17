'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * While prescription is still generating after COMPLETED, poll until aiReviewAt
 * is set, then refresh so fix prompts appear without a manual reload.
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

  useEffect(() => {
    if (!enabled) return
    cancelledRef.current = false
    let attempts = 0
    const maxAttempts = 45

    const tick = async () => {
      if (cancelledRef.current || attempts >= maxAttempts) return
      attempts += 1
      try {
        const res = await fetch(`/api/reports/${auditId}/status`)
        if (!res.ok) return
        const data = (await res.json()) as { aiReviewAt?: string | null }
        if (data.aiReviewAt) {
          router.refresh()
          return
        }
      } catch {
        // ignore transient poll errors
      }
      if (!cancelledRef.current) {
        window.setTimeout(tick, 2000)
      }
    }

    const timeout = window.setTimeout(tick, 1500)
    return () => {
      cancelledRef.current = true
      window.clearTimeout(timeout)
    }
  }, [auditId, enabled, router])

  return null
}
