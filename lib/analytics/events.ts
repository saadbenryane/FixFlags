import {
  fireGoogleAdsConversion,
  fireMetaPixelEvent,
  getGoogleAdsSignupLabel,
} from '@/lib/analytics/ad-conversions'
import { ensureGtagStub, isGaConfigured } from '@/lib/analytics/gtag'

/**
 * Funnel events for launch instrumentation.
 * `started_audit` is the product name for scan_submitted (kept for ad conversions).
 */
export type FunnelEvent =
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
  | 'report_auth_gate_viewed'
  | 'report_auth_method_selected'
  | 'report_auth_email_form_opened'
  | 'report_auth_gate_completed'
  | 'report_claimed'
  | 'report_prompts_unlocked'
  | 'audits_claimed'
  | 'product_contract_saved'
  | 'remember_shown'
  | 'managed_subscription'
  | 'share_link_created'
  | 'marketing_page_view'
  | 'beta_interest_submitted'
  | 'waitlist_joined'
  | 'plan_picker_viewed'
  | 'plan_picker_picked'
  | 'plan_picker_dismissed'
  | 'scan_limit_gate_signup_completed'
  | 'report_upgrade_gate_viewed'
  | 'report_progress_viewed'
  | 'sticky_nav_used'
  | 'polish_pass_copied'
  | 'flag_detail_viewed'

export type ReportSurface = 'focused' | 'details' | 'sample' | 'shared'
export type ReportAccessState = 'anonymous' | 'owner' | 'signed_in' | 'shared'

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
  viewed_report: {
    audit_id?: string
    is_owner?: boolean
    surface?: ReportSurface
    access_state?: ReportAccessState
    item_count?: number
  }
  first_finding_viewed: {
    audit_id?: string
    check_id?: string
    severity?: string
    surface?: ReportSurface
    access_state?: ReportAccessState
    item_position?: number
  }
  fix_prompt_copied: {
    kind?: 'flag' | 'plan' | 'export'
    audit_id?: string
    tool?: string
    surface?: ReportSurface
    access_state?: ReportAccessState
    item_position?: number
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
  report_auth_gate_viewed: { audit_id?: string }
  report_auth_method_selected: { audit_id?: string; method?: string; mode?: string }
  report_auth_email_form_opened: { audit_id?: string }
  report_auth_gate_completed: { audit_id?: string }
  report_claimed: { audit_id?: string }
  report_prompts_unlocked: { audit_id?: string; prompt_count?: number }
  audits_claimed: { claimed_count: number }
  product_contract_saved: { audit_id?: string }
  remember_shown: { audit_id?: string; learning_count?: number }
  managed_subscription: { action?: string }
  share_link_created: { audit_id?: string; kind?: 'share' | 'compare' }
  marketing_page_view: {
    page: string
    utm_source?: string
    utm_campaign?: string
    device?: string
  }
  beta_interest_submitted: { plan?: string; email?: string }
  waitlist_joined: { plan: string; source?: string }
  plan_picker_viewed: { source?: string; current_plan?: string }
  plan_picker_picked: { plan: string; source?: string }
  plan_picker_dismissed: { source?: string }
  scan_limit_gate_signup_completed: Record<string, never>
  report_upgrade_gate_viewed: { audit_id?: string }
  report_progress_viewed: {
    audit_id?: string
    progress_percent?: number
    status?: string
    surface?: ReportSurface
  }
  sticky_nav_used: {
    section_id: string
    audit_id?: string
    surface?: ReportSurface
  }
  polish_pass_copied: {
    audit_id?: string
    flag_count?: number
    surface?: ReportSurface
    access_state?: ReportAccessState
  }
  flag_detail_viewed: {
    audit_id?: string
    flag_id?: string
    check_id?: string
    severity?: string
    surface?: ReportSurface
    access_state?: ReportAccessState
    item_position?: number
  }
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
  if (!ensureGtagStub()) return
  if (!isGaConfigured() && process.env.NODE_ENV === 'production') return

  const eventParams = {
    device: deviceClass(),
    ...(params as Record<string, unknown> | undefined),
  }
  try {
    window.gtag!('event', event, eventParams)
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
    fireMetaPixelEvent('ViewContent', eventParams)
  }
}

export function trackLandingView() {
  trackEvent('landing_view', {
    path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    device: deviceClass(),
    ...utmParams(),
  })
}

export function trackMarketingPageView(page: string) {
  trackEvent('marketing_page_view', {
    page,
    device: deviceClass(),
    ...utmParams(),
  })
}
