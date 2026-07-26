'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { setActiveAudit } from '@/lib/audit/active-audit'
import {
  closeScanHandoff,
  openScanHandoff,
  setScanHandoffLimitGate,
  updateScanHandoffQueue,
} from '@/lib/audit/scan-handoff-store'
import { trackEvent } from '@/lib/analytics/events'

type CreateCheckBody = Record<string, unknown>

type StartScanOptions = {
  url: string
  /** Shown in handoff chrome immediately. */
  handoffUrl?: string
  body: CreateCheckBody
  /** POST path. Defaults to /api/checks. */
  endpoint?: string
  /** Analytics after success. */
  onStarted?: (data: Record<string, unknown>) => void
  /** Attribution for limit gate signup links. */
  limitFrom?: string
  /** Build nextPath for limit gate (defaults to dashboard?url=). */
  limitNextPath?: string
  errorFallback?: string
}

/**
 * Shared create → handoff → replace navigation used by AuditInput, re-check, and scan-deeper.
 */
export async function startScanWithHandoff(
  router: ReturnType<typeof useRouter>,
  options: StartScanOptions
): Promise<{ ok: boolean; reportId?: string }> {
  const handoffUrl = options.handoffUrl ?? options.url
  openScanHandoff(handoffUrl)

  try {
    const res = await fetch(options.endpoint ?? '/api/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options.body),
    })

    if (!res.ok) {
      const parsed = await parseApiErrorResponse(res)
      if (
        res.status === 402 ||
        (res.status === 401 && parsed.code === 'AUTH_REQUIRED')
      ) {
        setScanHandoffLimitGate({
          ...parsed,
          nextPath:
            options.limitNextPath ??
            `/dashboard?url=${encodeURIComponent(options.url)}`,
          from: options.limitFrom,
        })
        return { ok: false }
      }
      closeScanHandoff()
      toast.error(parsed.message || options.errorFallback || 'Something went wrong. Please try again.')
      return { ok: false }
    }

    const data = (await res.json()) as Record<string, unknown>
    const reportId = typeof data.reportId === 'string' ? data.reportId : ''
    options.onStarted?.(data)

    if (reportId) {
      const estimatedWaitSeconds =
        typeof data.estimatedWaitSeconds === 'number'
          ? data.estimatedWaitSeconds
          : undefined
      const queuePosition =
        typeof data.queuePosition === 'number' ? data.queuePosition : undefined
      updateScanHandoffQueue({ estimatedWaitSeconds, queuePosition })
      setActiveAudit({
        auditId: reportId,
        url: options.url,
        estimatedWaitSeconds,
        queuePosition,
      })
      // Commit the lightweight report independently of the large marketing-page
      // React tree. A client-router transition keeps the handoff portal and
      // homepage mounted together and can block input and paint under load.
      window.location.assign(`/report/${reportId}`)
      return { ok: true, reportId }
    }

    closeScanHandoff()
    router.replace('/dashboard')
    return { ok: true }
  } catch {
    closeScanHandoff()
    toast.error(options.errorFallback || 'Something went wrong. Please try again.')
    return { ok: false }
  }
}

export function trackStartedAudit(args: {
  source: string
  isLoggedIn: boolean
  ctaPlacement?: 'hero' | 'final' | 'dashboard' | 'other'
  utmSource?: string | null
  utmCampaign?: string | null
}) {
  trackEvent('started_audit', {
    source: args.source,
    is_logged_in: args.isLoggedIn,
    cta_placement: args.ctaPlacement,
    utm_source: args.utmSource ?? undefined,
    utm_campaign: args.utmCampaign ?? undefined,
  })
}
