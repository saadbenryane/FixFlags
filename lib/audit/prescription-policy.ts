export type PrescriptionAttention = 'flag' | 'recommendation'

/** Preserve the existing conditional-inspection acceptance boundary. */
export function isConditionalInspection(guidance: string): boolean {
  return /^\s*(?:(?:\d+[.)]|[-*])\s+)?(?:\*\*|__)?(?:review|inspect|confirm|check|assess|evaluate|compare)\b/i.test(guidance)
    && /\b(?:if|when|before|unless)\b/i.test(guidance)
}
