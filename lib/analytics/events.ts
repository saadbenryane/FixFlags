declare global {
  interface Window {
    gtag: (command: 'event', event: string, params?: Record<string, unknown>) => void
  }
}

type FunnelEvent =
  | 'started_audit'
  | 'signed_up'
  | 'signed_in'
  | 'audit_completed'
  | 'viewed_pricing'
  | 'started_checkout'
  | 'completed_checkout'
  | 'audit_limit_reached'
  | 'viewed_report'

type EventParams = {
  started_audit: { source?: string; is_logged_in?: boolean }
  signed_up: { method?: string; plan?: string }
  signed_in: { method?: string }
  audit_completed: { audit_id?: string; score?: number }
  viewed_pricing: { from?: string; plan?: string }
  started_checkout: { plan: string; is_logged_in: boolean }
  completed_checkout: { plan: string }
  audit_limit_reached: { reason?: string }
  viewed_report: { audit_id?: string; is_owner?: boolean }
}

export function trackEvent<T extends FunnelEvent>(
  event: T,
  params?: EventParams[T],
) {
  if (typeof window === 'undefined' || typeof window.gtag === 'undefined') return
  try {
    window.gtag('event', event, params as Record<string, unknown>)
  } catch {
    /* ga not available */
  }
}
