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
  | 'fix_prompt_copied'
  | 'recheck_started'
  | 'viewed_sample'
  | 'clicked_sample_cta'
  | 'audit_intent'

type EventParams = {
  started_audit: {
    source?: string
    is_logged_in?: boolean
    cta_placement?: 'hero' | 'final' | 'dashboard' | 'other'
  }
  signed_up: {
    method?: string
    plan?: string
    email?: string
    user_id?: string
    from?: string
  }
  signed_in: { method?: string }
  audit_completed: { audit_id?: string; score?: number }
  viewed_pricing: { from?: string; plan?: string }
  started_checkout: { plan: string; is_logged_in: boolean }
  completed_checkout: { plan: string }
  audit_limit_reached: { reason?: string }
  viewed_report: { audit_id?: string; is_owner?: boolean }
  fix_prompt_copied: {
    kind?: 'flag' | 'plan' | 'export'
    audit_id?: string
  }
  recheck_started: { audit_id?: string }
  viewed_sample: { placement: 'homepage' | 'samples' }
  clicked_sample_cta: { placement: 'hero' | 'how_it_works' | 'sample_section' }
  audit_intent: { cta_placement: 'hero' | 'final'; from: 'hero' | 'final' }
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
    // Shared deterministic eventID lets Meta dedupe this pixel event against
    // the server-side CAPI event fired from the better-auth user.create hook.
    const eventID = signupParams?.user_id ? `signup_${signupParams.user_id}` : undefined
    fireMetaPixelEvent('CompleteRegistration', undefined, eventID)
  }

  if (event === 'started_audit') {
    fireGoogleAdsConversion(undefined)
    fireMetaPixelEvent('Lead')
  }

  if (event === 'viewed_report') {
    fireMetaPixelEvent('ViewContent', params as Record<string, unknown>)
  }
}
