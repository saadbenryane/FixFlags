/**
 * Shared Attention judgment: which Flags deserve to be named, opened first,
 * or turned into the bounded Finish Plan. The complete Fix list stays intact.
 */

export const MIN_ATTENTION_CONFIDENCE = 0.65
export const MAX_ATTENTION_ITEMS = 3

export function isResolvedFlagStatus(status?: string | null): boolean {
  return status === 'FIXED' || status === 'IGNORED'
}

function isPolishSeverity(severity?: string | null): boolean {
  return (severity ?? '').toUpperCase() === 'POLISH'
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
