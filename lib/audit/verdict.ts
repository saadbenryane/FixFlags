/** Internal verdict copy written by the audit pipeline - not user-facing summaries. */
export const DETERMINISTIC_SCAN_VERDICT =
  'Deterministic scan complete. Create a free account for AI review, fix prompts, and rubric analysis.'

export const AI_SUMMARY_UNAVAILABLE_VERDICT =
  'AI summary unavailable, deterministic checks and screenshots are shown below.'

const SYSTEM_VERDICTS = new Set([DETERMINISTIC_SCAN_VERDICT, AI_SUMMARY_UNAVAILABLE_VERDICT])

export function isSystemVerdict(verdict: string | null | undefined): boolean {
  if (!verdict) return false
  return SYSTEM_VERDICTS.has(verdict)
}

/** Returns null for pipeline stub verdicts so UI can omit them. */
export function displayVerdict(verdict: string | null | undefined): string | null {
  if (!verdict || isSystemVerdict(verdict)) return null
  return verdict
}
