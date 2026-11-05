export type PrescriptionAttention = 'flag' | 'recommendation'

export const LEGACY_LOCKED_PROMPT_TEXT = [
  'Sign up',
  'Create a free account to see evidence and fix prompts.',
  'Sign up to see why this matters and get a fix prompt for your editor.',
  'Sign up to get the fix prompt.',
  'Sign up to see verification steps.',
] as const
const lockedPrompts = new Set<string>(LEGACY_LOCKED_PROMPT_TEXT)

/** Shared by rendered actions, owner commands and operator guidance visibility. */
export function isUsableFixPrompt(prompt: string | null | undefined): prompt is string {
  const trimmed = prompt?.trim()
  return Boolean(trimmed) && !lockedPrompts.has(trimmed!)
}

export const CONTEXTUAL_REVIEW_CHECK_IDS = ['cta-below-fold-mobile', 'placeholder-copy-detected'] as const
export const CONDITIONAL_INSPECTION_START = /^\s*(?:(?:\d+[.)]|[-*])\s+)?(?:\*\*|__)?(?:review|inspect|confirm|check|assess|evaluate|compare)\b/i
export const CONDITIONAL_INSPECTION_CONDITION = /\b(?:if|when|before|unless)\b/i

/** Position and phrase recognizers establish attributes, not task failure or unfinished intent. */
export function requiresContextualReview(checkId?: string | null): boolean {
  return (CONTEXTUAL_REVIEW_CHECK_IDS as readonly string[]).includes((checkId ?? '').split('::page:')[0])
}

/** Preserve the existing conditional-inspection acceptance boundary. */
export function isConditionalInspection(guidance: string): boolean {
  return CONDITIONAL_INSPECTION_START.test(guidance) && CONDITIONAL_INSPECTION_CONDITION.test(guidance)
}
