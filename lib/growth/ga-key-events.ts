/**
 * Funnel events that should be marked as GA4 key events (conversions).
 * Configure with: npm run growth:configure-ga4-key-events
 */
export const GA4_KEY_EVENTS = [
  'started_audit',
  'signed_up',
  'audits_claimed',
  'viewed_report',
  'fix_prompt_copied',
  'recheck_completed',
  'completed_checkout',
] as const

export type Ga4KeyEventName = (typeof GA4_KEY_EVENTS)[number]
