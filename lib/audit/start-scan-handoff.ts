'use client'

import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { trackEvent } from '@/lib/analytics/events'

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
          'Something went wrong. Try again.',
        code: parsed.code,
        action: parsed.action,
        status: res.status,
      }
    }

    const data = (await res.json()) as Record<string, unknown>
    const reportId = typeof data.reportId === 'string' ? data.reportId : ''
    options.onStarted?.(data)

    if (reportId) {
      // The report becomes the owner of active-audit state after it mounts.
      // Keeping creation stateless prevents the homepage resume banner from
      // becoming a competing foreground handoff.
      window.location.replace(`/report/${reportId}`)
      return { ok: true, reportId }
    }

    return {
      ok: false,
      message:
        options.errorFallback ||
        'Your review started, but FixFlags could not open the report. Try again.',
      code: 'REPORT_HANDOFF_MISSING',
    }
  } catch {
    return {
      ok: false,
      message:
        options.errorFallback ||
        'Something went wrong. Try again.',
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
