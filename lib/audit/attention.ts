/**
 * Shared Attention judgment: which Flags deserve to be named, opened first,
 * or turned into the bounded Finish Plan. The complete Fix list stays intact.
 *
 * Customer Flags on the Site board use `isCustomerFlag` (business importance),
 * not POLISH = Recommendation.
 */

export const MIN_ATTENTION_CONFIDENCE = 0.65
export const MAX_ATTENTION_ITEMS = 3

export function isResolvedFlagStatus(status?: string | null): boolean {
  return status === 'FIXED' || status === 'IGNORED'
}

function isPolishSeverity(severity?: string | null): boolean {
  return (severity ?? '').toUpperCase() === 'POLISH'
}

export type CustomerFlagInput = {
  severity?: string | null
  confidence?: number | null
  status?: string | null
  impactTag?: string | null
  checkId?: string | null
}

function checkBaseId(checkId?: string | null): string {
  return (checkId ?? '').split('::page:')[0]
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
  if (typeof flag.confidence === 'number' && flag.confidence < MIN_ATTENTION_CONFIDENCE) {
    return false
  }
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
export function isAttentionCandidate(flag: {
  severity?: string | null
  confidence?: number | null
  status?: string | null
}): boolean {
  if (isResolvedFlagStatus(flag.status)) return false
  if (isPolishSeverity(flag.severity)) return false
  if (typeof flag.confidence === 'number' && flag.confidence < MIN_ATTENTION_CONFIDENCE) {
    return false
  }
  return true
}

/**
 * Finish Plan / Improvement materialization. Same candidate rule, plus a
 * recommended change. A confirmed problem without a fix stays on the Fix list.
 */
export function isWorthwhileAttentionFlag(flag: {
  severity?: string | null
  confidence?: number | null
  status?: string | null
  recommendedChange?: string | null
  fix?: string | null
}): boolean {
  if (!isAttentionCandidate(flag)) return false
  const change = (flag.recommendedChange ?? flag.fix ?? '').trim()
  return change.length > 0
}
