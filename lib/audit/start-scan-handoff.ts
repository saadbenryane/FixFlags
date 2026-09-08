'use client'

import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { trackEvent } from '@/lib/analytics/events'

type CreateCheckBody = Record<string, unknown>

export type StartScanOptions = {
  url: string
  body: CreateCheckBody
  /** POST path. Defaults to /api/checks. */
  endpoint?: string
  /** Analytics after success. */
  onStarted?: (data: Record<string, unknown>) => void
  errorFallback?: string
  /**
   * Navigate to the Site board. Required so first analysis opens the same
   * Site identity the board polls.
   */
  navigate: (href: string) => void
}

export type CreateCheckResult =
  | { ok: true; reportId?: string; siteId: string }
  | {
      ok: false
      message: string
      code?: string
      action?: string
      status?: number
    }

/**
 * Shared check creation used by URL review, Update review, and scan-deeper actions.
 * Visual pending and error states belong to the control that initiated the request.
 * Always opens `/sites/{siteId}`. Missing siteId is a hard failure (no /report fallback).
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
    const siteId = typeof data.siteId === 'string' ? data.siteId.trim() : ''
    options.onStarted?.(data)

    if (!siteId) {
      return {
        ok: false,
        message:
          options.errorFallback ||
          'Your check started, but FixFlags could not open the Site board. Try again.',
        code: 'SITE_HANDOFF_MISSING',
      }
    }

    options.navigate(`/sites/${siteId}`)
    try {
      const { setActiveAudit } = await import('@/lib/audit/active-audit')
      setActiveAudit({
        auditId: reportId || siteId,
        siteId,
      })
    } catch {
      // Storage may be unavailable; navigation still opens the board.
    }
    return { ok: true, siteId, reportId: reportId || undefined }
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
