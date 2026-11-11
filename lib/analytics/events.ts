import {
  fireGoogleAdsConversion,
  fireMetaPixelEvent,
  getGoogleAdsSignupLabel,
} from '@/lib/analytics/ad-conversions'
import { getGoogleAnalyticsId, initializeGoogleTag, isGaConfigured } from '@/lib/analytics/gtag'
import { hasAnalyticsConsent, isGoogleAnalyticsEnabled } from '@/lib/analytics/consent'
import { readOrCreateAnalyticsJourneyId } from '@/lib/analytics/journey-id'
import { GUIDE_ANALYZE_EVENT } from '@/lib/analytics/guide-entry'
import { durableCheckId } from '@/lib/audit/check-identity'
import { controlledGoogleLocation } from '@/lib/analytics/controlled-pageview'

/**
 * Funnel events for launch instrumentation.
 * `started_audit` records a newly admitted analysis (kept for conversion reporting).
 */
export type FunnelEvent =
  | 'landing_view'
  | 'started_audit'
  | 'audit_reused'
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
  | 'report_prompts_unlocked'
  | 'audits_claimed'
  | 'product_contract_saved'
  | 'remember_shown'
  | 'managed_subscription'
  | 'marketing_page_view'
  | 'marketing_interaction'
  | typeof GUIDE_ANALYZE_EVENT
  | 'tool_interaction'
  | 'waitlist_joined'
  | 'requested_demo'
  | 'shopify_install_started'
  | 'shopify_install_completed'
  | 'shopify_first_verification'
  | 'shopify_monitoring_on'
  | 'shopify_alert_sent'
  | 'shopify_recovery_sent'
  | 'shopify_uninstalled'
  | 'plan_picker_viewed'
  | 'plan_picker_picked'
  | 'plan_picker_dismissed'
  | 'report_upgrade_gate_viewed'
  | 'report_progress_viewed'
  | 'polish_pass_copied'
  | 'flag_detail_viewed'
  | 'help_article_feedback'
  | 'help_search_no_results'
  | 'help_search_result_clicked'

export type ReportSurface = 'focused' | 'details' | 'sample' | 'shared' | 'product'
export type ReportAccessState = 'anonymous' | 'owner' | 'signed_in' | 'shared'

/** Retained names for historical reports. Current Site lifecycle facts live in site-events.ts. */
export const RETIRED_FUNNEL_EVENTS = [
  'audit_completed',
  'recheck_started',
  'recheck_completed',
  'report_prompts_unlocked',
  'product_contract_saved',
  'remember_shown',
  // The legacy report gate tracker was never mounted; Site signup and claim events replace these.
  'report_auth_gate_viewed',
  'report_auth_gate_completed',
  'report_upgrade_gate_viewed',
  // Emitted only by the removed progressive report workspace; Site events record the same moments.
  'first_finding_viewed',
  'report_progress_viewed',
  'polish_pass_copied',
  'flag_detail_viewed',
  // The standalone sample and demo-request journeys have been removed.
  'viewed_sample',
  'requested_demo',
] as const satisfies readonly FunnelEvent[]

export type AcquisitionTool = 'meta-preview' | 'placeholder-detector' | 'broken-links'
export type ToolResultOutcome =
  | 'succeeded'
  | 'api_error'
  | 'application_error'
  | 'network_error'
  | 'response_error'

type EventParams = {
  landing_view: {
    path?: string
    utm_source?: string
    utm_campaign?: string
    device?: string
    journey_id?: string
  }
  started_audit: {
    source?: string
    is_logged_in?: boolean
    cta_placement?: 'hero' | 'final' | 'dashboard' | 'other'
    utm_source?: string
    utm_campaign?: string
    journey_id?: string
    reused?: boolean
  }
  audit_reused: EventParams['started_audit']
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
    from: 'value_strip' | 'sample_fix' | 'limit_gate' | 'results_gate'
  }
  report_auth_gate_viewed: { audit_id?: string }
  report_auth_method_selected: { audit_id?: string; method?: string; mode?: string }
  report_auth_email_form_opened: { audit_id?: string }
  report_auth_gate_completed: { audit_id?: string }
  report_prompts_unlocked: { audit_id?: string; prompt_count?: number }
  audits_claimed: { claimed_count: number }
  product_contract_saved: { audit_id?: string }
  remember_shown: { audit_id?: string; learning_count?: number }
  managed_subscription: { action?: string }
  marketing_page_view: {
    page: string
    journey_id?: string
    utm_source?: string
    utm_campaign?: string
    device?: string
  }
  marketing_interaction: {
    page: string
    journey_id?: string
    action: 'navigate' | 'expand' | 'copy'
    target: string
  }
  [GUIDE_ANALYZE_EVENT]: { page: string; journey_id?: string }
  tool_interaction: {
    tool: AcquisitionTool
    outcome: 'submitted' | ToolResultOutcome
    journey_id?: string
  }
  waitlist_joined: { plan: string; source?: string }
  requested_demo: { plan: string; source?: string }
  shopify_install_started: { shop?: string }
  shopify_install_completed: { shop?: string }
  shopify_first_verification: { shop?: string; health?: string; has_evidence?: boolean }
  shopify_monitoring_on: { shop?: string }
  shopify_alert_sent: { shop?: string; health?: string }
  shopify_recovery_sent: { shop?: string }
  shopify_uninstalled: { shop?: string }
  plan_picker_viewed: { source?: string; current_plan?: string }
  plan_picker_picked: { plan: string; source?: string }
  plan_picker_dismissed: { source?: string }
  report_upgrade_gate_viewed: { audit_id?: string }
  report_progress_viewed: {
    audit_id?: string
    progress_percent?: number
    status?: string
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
  help_article_feedback: {
    article_slug: string
    helpful: boolean
  }
  help_search_no_results: {
    query: string
    filter?: string
  }
  help_search_result_clicked: {
    query: string
    filter?: string
    href: string
    surface: string
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
  const params = new URL(controlledGoogleLocation(new URL(window.location.href), false)).searchParams
  return {
    utm_source: params.get('utm_source') ?? undefined,
    utm_campaign: params.get('utm_campaign') ?? undefined,
  }
}

export function trackEvent<T extends FunnelEvent>(
  event: T,
  params?: EventParams[T],
) {
  if (typeof window === 'undefined') {
    console.info(
      JSON.stringify({
        event: 'funnel_event',
        name: event,
        ...(params as Record<string, unknown> | undefined),
      })
    )
    return
  }
  if (!isGoogleAnalyticsEnabled()) return
  if (!isGaConfigured()) return
  if (!initializeGoogleTag()) return

  const eventParams: Record<string, unknown> = {
    device: deviceClass(),
    ...(params as Record<string, unknown> | undefined),
    send_to: getGoogleAnalyticsId(),
  }
  // Keep operational identities out of browser analytics payloads.
  delete eventParams.email
  delete eventParams.user_id
  delete eventParams.audit_id
  delete eventParams.parent_audit_id
  delete eventParams.flag_id
  if (typeof eventParams.check_id === 'string') eventParams.check_id = durableCheckId(eventParams.check_id) ?? undefined
  try {
    window.gtag!('event', event, eventParams)
  } catch (error) {
    console.warn('Failed to send analytics event', {
      event,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  if (!hasAnalyticsConsent()) return

  if (event === 'signed_up') {
    const signupParams = params as EventParams['signed_up'] | undefined
    fireGoogleAdsConversion(getGoogleAdsSignupLabel(), {
      email: signupParams?.email,
    })
    const eventID = signupParams?.user_id ? `signup_${signupParams.user_id}` : undefined
    fireMetaPixelEvent('CompleteRegistration', undefined, eventID)
  }

  if (event === 'started_audit' && eventParams.reused === false) {
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
    journey_id: readOrCreateAnalyticsJourneyId() ?? undefined,
    ...utmParams(),
  })
}

export function trackMarketingPageView(page: string) {
  trackEvent('marketing_page_view', {
    page,
    journey_id: readOrCreateAnalyticsJourneyId() ?? undefined,
    device: deviceClass(),
    ...utmParams(),
  })
}

/** Tool telemetry accepts only finite labels, never submitted or returned content. */
export function trackToolInteraction(
  tool: AcquisitionTool,
  outcome: 'submitted' | ToolResultOutcome,
) {
  trackEvent('tool_interaction', {
    tool,
    outcome,
    journey_id: readOrCreateAnalyticsJourneyId() ?? undefined,
  })
}
