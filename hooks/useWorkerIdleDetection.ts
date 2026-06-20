'use client'

import { useEffect, useState } from 'react'

interface HealthResponse {
  queueWaiting?: string
  queueActive?: string
  worker?: string
  workerLikelyIdle?: string | boolean
}

/**
 * After `delaySeconds` in QUEUED, checks /api/health for jobs waiting with no active worker.
 */
export function useWorkerIdleDetection(
  status: string,
  delaySeconds = 25
): boolean {
  const [workerIdle, setWorkerIdle] = useState(false)

  useEffect(() => {
    if (status !== 'QUEUED') {
      setWorkerIdle(false)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/health')
        if (!res.ok || cancelled) return
        const data = (await res.json()) as HealthResponse
        if (cancelled) return

        const waiting = Number(data.queueWaiting ?? 0)
        const active = Number(data.queueActive ?? 0)
        const workerMissing = data.worker === 'missing'
        const idle =
          data.workerLikelyIdle === true ||
          data.workerLikelyIdle === 'true' ||
          (waiting > 0 && active === 0 && workerMissing)
        setWorkerIdle(idle)
      } catch {
        // ignore — health check is best-effort
      }
    }, delaySeconds * 1000)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [status, delaySeconds])

  return workerIdle
}
