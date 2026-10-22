/**
 * Shared Attention judgment: which Flags deserve to be named, opened first,
 * or turned into the bounded Finish Plan. The complete Fix list stays intact.
 *
 * Customer Flags on the Site board use `isCustomerFlag` (business importance),
 * not POLISH = Recommendation.
 */

import { hasUnreadableSupportingObservations, hasUnreadableStoredSupportingObservations } from './flag-observations'
import { searchAttentionDecision } from './search/policy'
import { requiresContextualReview } from './prescription-policy'

export const MIN_ATTENTION_CONFIDENCE = 0.65
export const MAX_ATTENTION_ITEMS = 3

export function isResolvedFlagStatus(status?: string | null): boolean {
  return status === 'FIXED' || status === 'IGNORED'
}

function isPolishSeverity(severity?: string | null): boolean {
  return (severity ?? '').toUpperCase() === 'POLISH'
}

export type CustomerFlagInput = {
  rubric?: string | null
  severity?: string | null
  confidence?: number | null
  status?: string | null
  impactTag?: string | null
  checkId?: string | null
  attentionPolicy?: unknown
  supportingObservations?: unknown
  supportingEvidenceUnreadable?: boolean
}

function checkBaseId(checkId?: string | null): string {
  return (checkId ?? '').split('::page:')[0]
}

/** Raw findings retain private evidence. Validated public projections carry
 * their server-derived readability decision explicitly. */
export function hasUnavailableFlagEvidence(flag: CustomerFlagInput): boolean {
  return flag.supportingEvidenceUnreadable === true || (flag.supportingEvidenceUnreadable === false
    ? hasUnreadableSupportingObservations(flag.supportingObservations)
    : hasUnreadableStoredSupportingObservations(flag.supportingObservations))
}

/** An unavailable important observation is a coverage gap, not a confirmed
 * failure. Optional recommendations do not invalidate independent checks. */
export function hasUnresolvedFlagEvidence(flag: CustomerFlagInput): boolean {
  return hasUnavailableFlagEvidence(flag) && isCustomerFlag({ ...flag, supportingEvidenceUnreadable: false, supportingObservations: undefined })
}

/** Journey, form, and conversion checks can be Flags even when severity is POLISH. */
export function isJourneyCritical(flag: CustomerFlagInput): boolean {
  const impact = (flag.impactTag ?? '').toUpperCase()
  const checkId = checkBaseId(flag.checkId)
  return (impact === 'REVENUE' || impact === 'CONVERSION') &&
    /(?:failed|failure|broken|blocked|error|no-confirmation|cannot|unreachable)/.test(checkId)
}

/**
 * Customer Flag = important enough to act on.
 * Remaining useful findings are Recommendations in card depth.
 */
export function isCustomerFlag(flag: CustomerFlagInput): boolean {
  if (isResolvedFlagStatus(flag.status)) return false
  if (hasUnavailableFlagEvidence(flag)) return false
  if (typeof flag.confidence === 'number' && flag.confidence < MIN_ATTENTION_CONFIDENCE) {
    return false
  }
  const search = searchAttentionDecision(flag)
  if (search) return search.kind === 'flag'
  if (requiresContextualReview(flag.checkId)) return false
  // These identities record attributes or phrase matches. They do not prove
  // behavioral failure, even when a historical collector gave higher severity.
  if (['form-missing-validation', 'h1-generic', 'no-cta-detected', 'journey-signup-too-many-fields', 'journey-funnel-timeout', 'journey-funnel-dead-end',
    'flow-destination-no-headline', 'flow-destination-cta-overload', 'journey-first-visit-destination-no-headline',
    'journey-pricing-evaluation-destination-no-headline', 'journey-first-visit-destination-no-next-action',
    'journey-pricing-evaluation-destination-no-next-action', 'journey-signup-no-form', 'journey-hidden-cta',
    'journey-first-visit-hidden-cta', 'journey-pricing-evaluation-hidden-cta', 'journey-signup-hidden-cta',
    'journey-checkout-hidden-cta', 'journey-contact-support-hidden-cta', 'journey-multi-step-funnel-hidden-cta',
    'journey-contact-not-found', 'journey-funnel-loop-detected'].includes(checkBaseId(flag.checkId)) ||
    /^(messaging-|friction-|trust-|hierarchy-|journey-(?:first-visit|pricing-evaluation|signup)-unclear-value-prop$|journey-funnel-(hesitation|confusion|too-many-steps|unclear-progress|missing-feedback|broken-promise|accessibility-barrier)$)/.test(checkBaseId(flag.checkId)) ||
    !flag.checkId && ['MESSAGE', 'EXPERIENCE', 'REACH'].includes(flag.rubric ?? '')) return false
  if (isJourneyCritical(flag)) return true
  if (flag.severity === 'CRITICAL') return true
  if (isPolishSeverity(flag.severity)) return false
  if (/^(title-too-long|description-too-long|og-|favicon)/.test(checkBaseId(flag.checkId))) return false
  return true
}

/**
 * A Flag that may be named as Attention. Polish, resolved, and low-confidence
 * observations stay in the Report. Agent uses this during a Review so it does
 * not wait for a recommended change that may still be streaming.
 */
export function isAttentionCandidate(flag: CustomerFlagInput): boolean {
  if (isResolvedFlagStatus(flag.status)) return false
  if (hasUnavailableFlagEvidence(flag)) return false
  if (isPolishSeverity(flag.severity)) return false
  if ((flag.checkId || flag.attentionPolicy) && !isCustomerFlag(flag)) return false
  if (typeof flag.confidence === 'number' && flag.confidence < MIN_ATTENTION_CONFIDENCE) {
    return false
  }
  return true
}

/**
 * Finish Plan / Improvement materialization. Same candidate rule, plus a
 * recommended change. A confirmed problem without a fix stays on the Fix list.
 */
export function isWorthwhileAttentionFlag(flag: CustomerFlagInput & {
  recommendedChange?: string | null
  fix?: string | null
}): boolean {
  if (!isAttentionCandidate(flag)) return false
  const change = (flag.recommendedChange ?? flag.fix ?? '').trim()
  return change.length > 0
}
