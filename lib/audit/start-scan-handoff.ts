'use client'

import { useRouter } from 'next/navigation'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { setActiveAudit } from '@/lib/audit/active-audit'
import { trackEvent } from '@/lib/analytics/events'
import type { QueueStatus } from '@/lib/queue/estimate'

type CreateCheckBody = Record<string, unknown>

type StartScanOptions = {
  url: string
  body: CreateCheckBody
  /** POST path. Defaults to /api/checks. */
  endpoint?: string
  /** Analytics after success. */
  onStarted?: (data: Record<string, unknown>) => void
  errorFallback?: string
}

export type CreateCheckResult =
  | { ok: true; reportId?: string }
  | {
      ok: false
      message: string
      code?: string
      action?: string
      status?: number
    }

/**
 * Shared check creation used by URL review, Re-check, and scan-deeper actions.
 * Visual pending and error states belong to the control that initiated the request.
 */
export async function startScanWithHandoff(
  router: ReturnType<typeof useRouter>,
  options: StartScanOptions
): Promise<CreateCheckResult> {
  try {
    const res = await fetch(options.endpoint ?? '/api/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options.body),
    })

    if (!res.ok) {
      const parsed = await parseApiErrorResponse(res)
      return {
        ok: false,
        message:
          parsed.message ||
          options.errorFallback ||
          'Something went wrong. Please try again.',
        code: parsed.code,
        action: parsed.action,
        status: res.status,
      }
    }

    const data = (await res.json()) as Record<string, unknown>
    const reportId = typeof data.reportId === 'string' ? data.reportId : ''
    options.onStarted?.(data)

    if (reportId) {
      const queue =
        data.queue && typeof data.queue === 'object'
          ? data.queue as QueueStatus
          : undefined
      setActiveAudit({
        auditId: reportId,
        url: options.url,
        queue,
      })
      window.location.assign(`/report/${reportId}`)
      return { ok: true, reportId }
    }

    router.replace('/dashboard')
    return { ok: true }
  } catch {
    return {
      ok: false,
      message:
        options.errorFallback ||
        'Something went wrong. Please try again.',
    }
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
