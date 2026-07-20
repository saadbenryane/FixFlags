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

/**
 * Funnel events for launch instrumentation.
 * `started_audit` is the product name for scan_submitted (kept for ad conversions).
 */
type FunnelEvent =
  | 'landing_view'
  | 'started_audit'
  | 'scan_validation_failed'
  | 'signed_up'
  | 'signup_started'
  | 'signed_in'
  | 'audit_completed'
  | 'viewed_pricing'
  | 'started_checkout'
  | 'completed_checkout'
  | 'audit_limit_reached'
  | 'viewed_report'
  | 'first_finding_viewed'
  | 'fix_prompt_copied'
  | 'recheck_started'
  | 'recheck_completed'
  | 'viewed_sample'
  | 'clicked_sample_cta'
  | 'audit_intent'
  | 'report_signup_cta_clicked'
  | 'audits_claimed'

type EventParams = {
  landing_view: {
    path?: string
    utm_source?: string
    utm_campaign?: string
    device?: string
  }
  started_audit: {
    source?: string
    is_logged_in?: boolean
    cta_placement?: 'hero' | 'final' | 'dashboard' | 'other'
    utm_source?: string
    utm_campaign?: string
  }
  scan_validation_failed: {
    reason?: string
    cta_placement?: 'hero' | 'final' | 'dashboard' | 'other'
  }
  signed_up: {
    method?: string
    plan?: string
    email?: string
    user_id?: string
    from?: string
  }
  signup_started: { method?: string; from?: string }
  signed_in: { method?: string }
  audit_completed: {
    audit_id?: string
    score?: number
    duration_ms?: number
    finding_count?: number
    highest_severity?: string
  }
  viewed_pricing: { from?: string; plan?: string }
  started_checkout: { plan: string; is_logged_in: boolean }
  completed_checkout: { plan: string }
  audit_limit_reached: { reason?: string }
  viewed_report: { audit_id?: string; is_owner?: boolean }
  first_finding_viewed: {
    audit_id?: string
    check_id?: string
    severity?: string
  }
  fix_prompt_copied: {
    kind?: 'flag' | 'plan' | 'export'
    audit_id?: string
    tool?: string
  }
  recheck_started: { audit_id?: string }
  recheck_completed: {
    audit_id?: string
    parent_audit_id?: string
    outcome?: string
  }
  viewed_sample: { placement: 'homepage' | 'samples' }
  clicked_sample_cta: { placement: 'hero' | 'how_it_works' | 'sample_section' }
  audit_intent: { cta_placement: 'hero' | 'final'; from: 'hero' | 'final' }
  report_signup_cta_clicked: {
    from: 'value_strip' | 'sample_fix' | 'limit_gate'
  }
  audits_claimed: { claimed_count: number }
}

function deviceClass(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window.innerWidth
  if (w < 640) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

function utmParams(): { utm_source?: string; utm_campaign?: string } {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  return {
    utm_source: params.get('utm_source') ?? undefined,
    utm_campaign: params.get('utm_campaign') ?? undefined,
  }
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

  if (event === 'signed_up') {
    const signupParams = params as EventParams['signed_up'] | undefined
    fireGoogleAdsConversion(getGoogleAdsSignupLabel(), {
      email: signupParams?.email,
    })
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

export function trackLandingView() {
  trackEvent('landing_view', {
    path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    device: deviceClass(),
    ...utmParams(),
  })
}
