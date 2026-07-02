import {
  fireGoogleAdsConversion,
  fireMetaPixelEvent,
  getGoogleAdsSignupLabel,
} from '@/lib/analytics/ad-conversions'

declare global {
  interface Window {
    gtag: (
      command: 'event' | 'config' | 'set',
      target: string,
      params?: Record<string, unknown>
    ) => void
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
  signed_up: { method?: string; plan?: string; email?: string }
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

  if (typeof window === 'undefined') return

  if (event === 'signed_up') {
    const signupParams = params as EventParams['signed_up'] | undefined
    fireGoogleAdsConversion(getGoogleAdsSignupLabel(), {
      email: signupParams?.email,
    })
    fireMetaPixelEvent('CompleteRegistration')
  }

  if (event === 'started_audit') {
    fireGoogleAdsConversion(undefined)
    fireMetaPixelEvent('Lead')
  }

  if (event === 'viewed_report') {
    fireMetaPixelEvent('ViewContent', params as Record<string, unknown>)
  }
}

export async function trackSignupServerSide(input: {
  email?: string
  eventSourceUrl?: string
}): Promise<void> {
  try {
    const fbc = document.cookie.match(/(?:^|; )_fbc=([^;]+)/)?.[1]
    const fbp = document.cookie.match(/(?:^|; )_fbp=([^;]+)/)?.[1]
    await fetch('/api/conversions/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email,
        fbc: fbc ? decodeURIComponent(fbc) : undefined,
        fbp: fbp ? decodeURIComponent(fbp) : undefined,
        eventSourceUrl: input.eventSourceUrl ?? window.location.href,
      }),
    })
  } catch {
    /* server conversion is best-effort */
  }
}
