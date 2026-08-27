/**
 * Funnel events that should be marked as GA4 key events (conversions).
 * Configure with: npm run growth:configure-ga4-key-events
 */
export const GA4_KEY_EVENTS = [
  'started_audit',
  'viewed_report',
  'report_signup_cta_clicked',
  'signed_up',
  'audits_claimed',
  'fix_prompt_copied',
  'recheck_completed',
  'completed_checkout',
] as const

export type Ga4KeyEventName = (typeof GA4_KEY_EVENTS)[number]
