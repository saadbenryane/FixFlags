'use client'

import { useEffect } from 'react'
import { useOneShotEvent } from '@/lib/hooks/useOneShotEvent'
import { trackEvent } from '@/lib/analytics/events'

/**
 * Tracks the report auth gate lifecycle: the sign-in surface anonymous
 * viewers see to unlock prompts, and its resolution once sign-in/claim
 * completes and the gate no longer renders for that report.
 */
export function ReportAuthGateTracker({
  auditId,
  gateShown,
  enabled = true,
}: {
  auditId: string
  gateShown: boolean
  enabled?: boolean
}) {
  useOneShotEvent(
    'report_auth_gate_viewed',
    auditId,
    () => (enabled && gateShown ? {} : null),
    [auditId, enabled, gateShown],
  )

  useEffect(() => {
    if (!enabled || gateShown || typeof window === 'undefined') return
    // A gate counts as completed only if this session first saw it on this
    // report (same tab) and it is now resolved. useOneShotEvent writes this
    // storage key when the viewed event fires.
    const viewedKey = `fixflags:event:report_auth_gate_viewed:${auditId}`
    if (!window.sessionStorage.getItem(viewedKey)) return
    const completedKey = `fixflags:event:report_auth_gate_completed:${auditId}`
    if (window.sessionStorage.getItem(completedKey)) return
    window.sessionStorage.setItem(completedKey, '1')
    trackEvent('report_auth_gate_completed', { audit_id: auditId })
  }, [auditId, enabled, gateShown])

  return null
}
